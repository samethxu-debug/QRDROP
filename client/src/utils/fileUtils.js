import JSZip from 'jszip';

/**
 * Recursively extracts all actual files from DataTransferItems (drag and drop folders)
 * or FileList (file/folder inputs), discarding 0-byte directory node placeholders.
 */
export async function processIncomingFiles(dataTransferOrFileList) {
  let allFiles = [];
  let detectedFolder = '';

  // 1. Handle Drag & Drop items if dataTransfer.items is available
  if (dataTransferOrFileList?.items && dataTransferOrFileList.items.length > 0) {
    const items = Array.from(dataTransferOrFileList.items);
    const filePromises = items.map((item) => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          if (entry.isDirectory && !detectedFolder) {
            detectedFolder = entry.name;
          }
          return readEntryRecursively(entry);
        } else {
          const file = item.getAsFile();
          return Promise.resolve(file ? [file] : []);
        }
      }
      return Promise.resolve([]);
    });

    const results = await Promise.all(filePromises);
    allFiles = results.flat();
  } else if (dataTransferOrFileList?.files || Array.isArray(dataTransferOrFileList)) {
    // 2. Handle FileList or File Array
    const rawList = dataTransferOrFileList.files ? Array.from(dataTransferOrFileList.files) : Array.from(dataTransferOrFileList);
    allFiles = rawList;
  }

  // Detect top folder name from webkitRelativePath if not set
  if (!detectedFolder && allFiles.length > 0) {
    for (const f of allFiles) {
      if (f.webkitRelativePath && f.webkitRelativePath.includes('/')) {
        detectedFolder = f.webkitRelativePath.split('/')[0];
        break;
      }
    }
  }

  // Filter out any 0-byte empty directory node objects (files without extension and size 0)
  const validFiles = allFiles.filter((file) => {
    if (!file) return false;
    // Keep file if size > 0 OR if it has a valid extension (e.g. .txt, .json, .js, .png)
    const hasExtension = file.name && file.name.includes('.') && !file.name.endsWith('.');
    return file.size > 0 || hasExtension;
  });

  return {
    files: validFiles,
    detectedFolderName: detectedFolder,
  };
}

function readEntryRecursively(entry, relativePath = '') {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (file) => {
          const fullRelPath = relativePath ? `${relativePath}/${file.name}` : file.name;
          Object.defineProperty(file, 'webkitRelativePath', {
            value: fullRelPath,
            writable: false,
            configurable: true,
          });
          resolve([file]);
        },
        () => resolve([])
      );
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entriesAcc = [];

      const readEntries = () => {
        dirReader.readEntries(
          async (entries) => {
            if (entries.length === 0) {
              const currentRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
              const nestedPromises = entriesAcc.map((child) => readEntryRecursively(child, currentRelPath));
              const nestedArrays = await Promise.all(nestedPromises);
              resolve(nestedArrays.flat());
            } else {
              entriesAcc.push(...entries);
              readEntries();
            }
          },
          () => resolve([])
        );
      };

      readEntries();
    } else {
      resolve([]);
    }
  });
}

/**
 * Client-side ZIP packager: Packages a folder or multiple files into a clean .zip archive File
 */
export async function packageFolderToZip(filesList, zipName = 'Folder_Archive') {
  const zip = new JSZip();
  const folder = zip.folder(zipName);

  for (const file of filesList) {
    const filePath = file.webkitRelativePath || file.name;
    const arrayBuffer = await file.arrayBuffer();
    folder.file(filePath.replace(/^[^\/]+\//, ''), arrayBuffer);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const cleanZipName = `${zipName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
  return new File([blob], cleanZipName, { type: 'application/zip' });
}
