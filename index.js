"use strict";

const fse = require("fs-extra");
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
      "after:package:finalize": this.updatePackage.bind(this)
    };
  }

  async updatePackage() {
    this.serverless.cli.log("Updating package paths...");

    return await Promise.all(
      Object.keys(this.serverless.service.layers).map(async layerName => {
        const zipFileName = `${layerName}.zip`;
        const layerObject = this.serverless.service.getLayer(layerName);

        const artifactFilePath = path.join(
          this.serverless.config.servicePath,
          ".serverless",
          zipFileName
        );

        const filePaths = await this.resolveFilePathsLayer(layerName);
        const buffer = await fse.readFileAsync(artifactFilePath);
        const zip = await JSZip.loadAsync(buffer);
        const newPackage = new JSZip();
        const packages_path = this.serverless.service.custom.packagePath.path;
        const packages = newPackage.folder(packages_path);
        const layer = packages.folder(layerObject.path);

        await Promise.all(
          Object.keys(zip.files).map(async file => {
            const content = await zip.file(file).async("string");

            if (filePaths.includes(file)) {
              return layer.file(file, content);
            }

            return packages.file(file, content);
          })
        );

        return new Promise(resolve => {
          newPackage
            .generateNodeStream({
              type: "nodebuffer",
              streamFiles: true,
              compression: "DEFLATE",
              compressionOptions: {
                level: 9
              }
            })
            .pipe(fse.createWriteStream(artifactFilePath))
            .on("finish", function() {
              resolve();
            });
        });
      })
    );
  }
}

module.exports = ServerlessPluginPackagePath;
