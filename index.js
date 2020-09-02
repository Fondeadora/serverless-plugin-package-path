"use strict";

const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");

const packageService = require("serverless/lib/plugins/package/lib/packageService");
const zipService = require("serverless/lib/plugins/package/lib/zipService");

class ServerlessPluginPackagePath {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider("aws");

    Object.assign(this, packageService, zipService);

    this.commands = {};

    this.hooks = {
      "after:package:createDeploymentArtifacts": this.updateServicePath.bind(
        this
      ),
      "after:package:finalize": this.updateRequirementsPath.bind(this)
    };
  }

  async updateServicePath() {
    this.serverless.cli.log("Updating service files paths...");

    return await Promise.all(
      Object.keys(this.serverless.service.layers).map(async layerName => {
        const layerObject = this.serverless.service.getLayer(layerName);

        const artifactFilePath = this._artifactFilePath(layerName);
        const packagesPath = this.serverless.service.custom.packagePath.path;

        const artifactBuffer = await fs.readFileAsync(artifactFilePath);

        const tmpPackage = new JSZip();
        const serviceFolder = tmpPackage.folder(
          path.join(packagesPath, layerObject.path)
        );

        await serviceFolder.loadAsync(artifactBuffer);

        await this._writeToFile(new JSZip(), artifactFilePath);

        return await this._writeToFile(tmpPackage, this._tmpFilePath());
      })
    );
  }

  async updateRequirementsPath() {
    this.serverless.cli.log("Updating requirements paths...");

    return await Promise.all(
      Object.keys(this.serverless.service.layers).map(async layerName => {
        const artifactFilePath = this._artifactFilePath(layerName);
        const packagesPath = this.serverless.service.custom.packagePath.path;

        const artifactBuffer = await fs.readFileAsync(artifactFilePath);
        const tmpBuffer = await fs.readFileAsync(this._tmpFilePath());

        const artifact = new JSZip();
        const packagesFolder = artifact.folder(packagesPath);

        await artifact.loadAsync(tmpBuffer);
        await packagesFolder.loadAsync(artifactBuffer);

        return this._writeToFile(artifact, artifactFilePath);
      })
    );
  }

  _artifactFilePath(layerName) {
    const zipFileName = `${layerName}.zip`;

    return path.join(
      this.serverless.config.servicePath,
      ".serverless",
      zipFileName
    );
  }

  _tmpFilePath() {
    return path.join(this.serverless.config.servicePath, ".serverless", "tmp");
  }

  async _writeToFile(zipFile, filePath) {
    return await new Promise(resolve =>
      zipFile
        .generateNodeStream({
          type: "nodebuffer",
          streamFiles: true,
          compression: "DEFLATE",
          compressionOptions: {
            level: 9
          }
        })
        .pipe(fs.createWriteStream(filePath))
        .on("finish", resolve)
    );
  }
}

module.exports = ServerlessPluginPackagePath;
