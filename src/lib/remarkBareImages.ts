import type { Image, Parent, Root, RootContent, Text } from "mdast";

// Lemmy clients frequently post bare image/GIF URLs as plain text. This remark
// plugin promotes those URLs to image nodes so they render inline, while leaving
// code, explicit links, and existing images untouched (it only rewrites text nodes).
const IMAGE_URL = /https?:\/\/[^\s<>]+?\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#][^\s<>]*)?/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

const SKIP_PARENTS = new Set(["link", "linkReference", "image", "imageReference", "definition"]);

function splitText(node: Text): RootContent[] | null {
  const value = node.value;
  const out: RootContent[] = [];
  let last = 0;
  let changed = false;

  for (const match of value.matchAll(IMAGE_URL)) {
    const start = match.index ?? 0;
    let url = match[0];
    // Don't swallow sentence punctuation or a closing bracket that follows the URL.
    const trimmed = url.replace(TRAILING_PUNCTUATION, "");
    if (trimmed.length < url.length && !/[?#]/.test(trimmed)) {
      // Only trim if the extension still terminates the URL after trimming.
      if (!/\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(trimmed)) continue;
    }
    url = trimmed;
    const end = start + url.length;
    if (start > last) out.push({ type: "text", value: value.slice(last, start) });
    const image: Image = { type: "image", url, alt: "" };
    out.push(image);
    last = end;
    changed = true;
  }

  if (!changed) return null;
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function walk(parent: Parent) {
  if (SKIP_PARENTS.has(parent.type)) return;
  const next: RootContent[] = [];
  let changed = false;
  for (const child of parent.children as RootContent[]) {
    if (child.type === "text") {
      const replacement = splitText(child);
      if (replacement) {
        next.push(...replacement);
        changed = true;
        continue;
      }
    } else if ("children" in child) {
      walk(child as Parent);
    }
    next.push(child);
  }
  if (changed) parent.children = next as Parent["children"];
}

export default function remarkBareImages() {
  return (tree: Root) => {
    walk(tree);
  };
}
