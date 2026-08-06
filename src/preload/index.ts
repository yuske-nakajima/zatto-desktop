import { ipcRenderer, webUtils } from "electron";
import { createHtmlFileDropShield } from "./html-file-drop-shield";

const HTML_FILE_DROP_CHANNEL = "zatto-desktop:drop-html-files";
const MAX_HTML_FILE_COUNT = 256;
const dropShield = createHtmlFileDropShield(document);

function isHtmlFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".html") || name.endsWith(".htm");
}

document.addEventListener("dragover", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dropShield.show(event.dataTransfer?.files ?? []);
});

document.addEventListener("dragenter", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dropShield.show(event.dataTransfer?.files ?? []);
});

document.addEventListener("dragend", () => dropShield.hide());

document.addEventListener("dragleave", (event) => {
  if (
    event.relatedTarget === null &&
    (event.clientX <= 0 ||
      event.clientY <= 0 ||
      event.clientX >= document.documentElement.clientWidth ||
      event.clientY >= document.documentElement.clientHeight)
  ) {
    dropShield.hide();
  }
});

document.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;
  if (files === undefined) return;
  event.preventDefault();
  dropShield.markDropped();
  const htmlFiles: File[] = [];
  for (const file of files) {
    if (isHtmlFile(file)) htmlFiles.push(file);
    if (htmlFiles.length > MAX_HTML_FILE_COUNT) break;
  }
  if (htmlFiles.length > MAX_HTML_FILE_COUNT) {
    ipcRenderer.send(HTML_FILE_DROP_CHANNEL, { kind: "too-many-files" });
    return;
  }
  const paths = htmlFiles
    .map((file) => webUtils.getPathForFile(file))
    .filter((filePath) => filePath.length > 0);
  if (paths.length > 0) ipcRenderer.send(HTML_FILE_DROP_CHANNEL, paths);
});

function isFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") === true;
}
