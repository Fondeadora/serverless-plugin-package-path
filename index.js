"use strict";

const fs = require("fs");
const fsPromises = require("fs").promises;
const JSZip = require("jszip");
const path = require("path");

class ServerlessPluginPackagePath {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider("aws");

    this.hooks = {
      "after:package:createDeploymentArtifacts":
        this.updateServicePath.bind(this),
      "before:package:compileLayers": this.updateRequirementsPath.bind(this),
    };
  }

  async updateServicePath() {
    this.serverless.cli.log("Updating service files paths...");

    const layers = this.serverless.service.layers;
    const packagesPath = this.serverless.service.custom.packagePath.path;

    await Promise.all(
      Object.keys(layers).map(async (layerName) => {
        const layerObject = this.serverless.service.getLayer(layerName);
        const artifactFilePath = this._getArtifactPath(layerName);

        const artifactBuffer = await fsPromises.readFile(artifactFilePath);

        const tmpPackage = new JSZip();
        const serviceFolder = tmpPackage.folder(
          path.join(packagesPath, layerObject.path)
        );
        await serviceFolder.loadAsync(artifactBuffer);

        await Promise.all([
          this._writeZipToFile(new JSZip(), artifactFilePath),
          this._writeZipToFile(tmpPackage, this._getTmpPath()),
        ]);
      })
    );
  }

  async updateRequirementsPath() {
    this.serverless.cli.log("Updating requirements paths...");

    const layers = this.serverless.service.layers;
    const packagesPath = this.serverless.service.custom.packagePath.path;
    const tmpFilePath = this._getTmpPath();

    await Promise.all(
      Object.keys(layers).map(async (layerName) => {
        const artifactFilePath = this._getArtifactPath(layerName);

        const [artifactBuffer, tmpBuffer] = await Promise.all([
          fsPromises.readFile(artifactFilePath),
          fsPromises.readFile(tmpFilePath),
        ]);

        const artifact = new JSZip();
        await artifact.loadAsync(tmpBuffer);

        const packagesFolder = artifact.folder(packagesPath);
        await packagesFolder.loadAsync(artifactBuffer);

        await this._writeZipToFile(artifact, artifactFilePath);
      })
    );
  }

  _getArtifactPath(layerName) {
    return path.join(
      this.serverless.config.servicePath,
      ".serverless",
      `${layerName}.zip`
    );
  }

  _getTmpPath() {
    return path.join(
      this.serverless.config.servicePath,
      ".serverless",
      "tmp.zip"
    );
  }

  _writeZipToFile(zipFile, filePath) {
    return new Promise((resolve, reject) => {
      zipFile
        .generateNodeStream({
          type: "nodebuffer",
          streamFiles: true,
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        })
        .pipe(fs.createWriteStream(filePath))
        .on("finish", resolve)
        .on("error", reject);
    });
  }
}

module.exports = ServerlessPluginPackagePath;
