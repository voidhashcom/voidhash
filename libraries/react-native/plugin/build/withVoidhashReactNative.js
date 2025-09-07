"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("expo/config-plugins");
const package_json_1 = __importDefault(require("../../package.json"));
const withVoidhashReactNative = (config) => {
    return config;
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(withVoidhashReactNative, package_json_1.default.name, package_json_1.default.version);
