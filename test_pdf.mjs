import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
console.log("pdfjs keys:", Object.keys(pdfjs).slice(0, 10));
console.log("getDocument type:", typeof pdfjs.getDocument);
const loadingTask = pdfjs.getDocument({ data: new Uint8Array([1,2,3]) });
console.log("loadingTask type:", typeof loadingTask);
console.log("has promise:", !!loadingTask.promise);
