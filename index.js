"use strict";

const fs = require("fs").promises;
const JSZip = require("jszip");
const path = require("path");

class ServerlessPluginPackagePath {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider("aws");

    this.commands = {};

    this.hooks = {
      "before:package:finalize": this.repackageLayer.bind(this),
    };
  }

  async repackageLayer() {
    this.serverless.cli.log("Repackaging layers with custom path...");

    const layers = Object.keys(this.serverless.service.layers || {});

    // If no layers defined (using pythonRequirements.layer), check for pythonRequirements.zip
    if (layers.length === 0) {
      const serverlessDir = path.join(
        this.serverless.config.servicePath,
        ".serverless"
      );
      const pythonReqZip = path.join(serverlessDir, "pythonRequirements.zip");

      if (
        await fs
          .access(pythonReqZip)
          .then(() => true)
          .catch(() => false)
      ) {
        return this._repackageSingleLayer(pythonReqZip);
      } else {
        this.serverless.cli.log("No layers found to repackage");
        return;
      }
    }

    return await Promise.all(
      layers.map(async (layerName) => {
        const layerObject = this.serverless.service.getLayer(layerName);
        const artifactFilePath = this._artifactFilePath(layerName);
        return this._repackageSingleLayer(artifactFilePath, layerObject.path);
      })
    );
  }

  async _repackageSingleLayer(artifactFilePath, layerPath = "") {
    const targetPath = this.serverless.service.custom.packagePath.path;

    // Check if the file is a symlink - if so, replace it with a real file
    try {
      const stats = await fs.lstat(artifactFilePath);
      if (stats.isSymbolicLink()) {
        const realPath = await fs.realpath(artifactFilePath);
        // Read from the cached file
        const cachedBuffer = await fs.readFile(realPath);
        // Remove the symlink
        await fs.unlink(artifactFilePath);
        // Write the cached content as a real file
        await fs.writeFile(artifactFilePath, cachedBuffer);
      }
    } catch (e) {
      // File might not exist or other error, continue anyway
    }

    // Read the original zip once
    const originalBuffer = await fs.readFile(artifactFilePath);
    const originalZip = await JSZip.loadAsync(originalBuffer);

    // Create new zip with restructured paths
    const newZip = new JSZip();
    const targetFolder = path.join(targetPath, layerPath);

    // Move all files to the new path structure
    const filePromises = [];
    originalZip.forEach((relativePath, file) => {
      if (!file.dir) {
        // Strip 'python/' prefix if it exists (serverless-python-requirements adds it)
        const cleanPath = relativePath.startsWith("python/")
          ? relativePath.substring("python/".length)
          : relativePath;

        const newPath = path.join(targetFolder, cleanPath);
        filePromises.push(
          file.async("nodebuffer").then((content) => {
            newZip.file(newPath, content, {
              binary: true,
              compression: "DEFLATE",
            });
          })
        );
      }
    });

    await Promise.all(filePromises);

    // Write the new zip back to the artifact file
    return this._writeZipToFile(newZip, artifactFilePath);
  }

  _artifactFilePath(layerName) {
    const zipFileName = `${layerName}.zip`;

    return path.join(
      this.serverless.config.servicePath,
      ".serverless",
      zipFileName
    );
  }

  async _writeZipToFile(zipFile, filePath) {
    const fsSync = require("fs");
    return new Promise((resolve, reject) => {
      zipFile
        .generateNodeStream({
          type: "nodebuffer",
          streamFiles: true,
          compression: "DEFLATE",
          compressionOptions: {
            level: 9,
          },
        })
        .pipe(fsSync.createWriteStream(filePath))
        .on("finish", resolve)
        .on("error", reject);
    });
  }
}

module.exports = ServerlessPluginPackagePath;
