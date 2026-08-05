import { ipcRenderer, webUtils } from "electron";

const HTML_FILE_DROP_CHANNEL = "zatto-desktop:drop-html-files";
const MAX_HTML_FILE_COUNT = 256;

function isHtmlFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".html") || name.endsWith(".htm");
}

document.addEventListener("dragover", (event) => {
  if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
});

document.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;
  if (files === undefined) return;
  event.preventDefault();
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
