import { join, resolve } from 'path';
import { accessSync, readJSONSync, statSync } from 'fs-extra';

import { Logger } from '../logger/logger';
import { BuildContext, TaskInfo } from './interfaces';
import { getBooleanPropertyValue, objectAssign } from './helpers';
import { FileCache } from './file-cache';
import * as Constants from './constants';

/**
 * Create a context object which is used by all the build tasks.
 * Filling the config data uses the following hierarchy, which will
 * keep going down the list until it, or if it, finds data.
 *
 * 1) Get from the passed in context variable
 * 2) Get from the config file set using the command-line args
 * 3) Get from environment variable
 * 4) Get from package.json config property
 * 5) Get environment variables
 *
 * Lastly, Ionic's default configs will always fill in any data
 * which is missing from the user's data.
 */
export function generateContext(context?: BuildContext): BuildContext {
  if (!context) {
    context = {};
    context.fileCache = new FileCache();
  }

  context.isProd = [
    context.isProd,
    hasArg('--prod')
  ].find(val => typeof val === 'boolean');

  setProcessEnvVar(Constants.ENV_VAR_IONIC_ENV, (context.isProd ? Constants.ENV_VAR_PROD : Constants.ENV_VAR_DEV));

  // If context is prod then the following flags must be set to true
  context.runAot = [
    context.runAot,
    context.isProd || hasArg('--aot'),
  ].find(val => typeof val === 'boolean');

  context.runMinifyJs = [
    context.runMinifyJs,
    context.isProd || hasArg('--minifyJs')
  ].find(val => typeof val === 'boolean');

  context.runMinifyCss = [
    context.runMinifyCss,
    context.isProd || hasArg('--minifyCss')
  ].find(val => typeof val === 'boolean');

  context.optimizeJs = [
    context.optimizeJs,
    context.isProd || hasArg('--optimizeJs')
  ].find(val => typeof val === 'boolean');

  if (typeof context.isWatch !== 'boolean') {
    context.isWatch = hasArg('--watch');
  }

  context.rootDir = resolve(context.rootDir || getConfigValue(context, '--rootDir', null, Constants.ENV_VAR_ROOT_DIR, Constants.ENV_VAR_ROOT_DIR.toLowerCase(), processCwd));
  setProcessEnvVar(Constants.ENV_VAR_ROOT_DIR, context.rootDir);
  Logger.debug(`rootDir set to ${context.rootDir}`);

  context.tmpDir = resolve(context.tmpDir || getConfigValue(context, '--tmpDir', null, Constants.ENV_VAR_TMP_DIR, Constants.ENV_VAR_TMP_DIR.toLowerCase(), join(context.rootDir, Constants.TMP_DIR)));
  setProcessEnvVar(Constants.ENV_VAR_TMP_DIR, context.tmpDir);
  Logger.debug(`tmpDir set to ${context.tmpDir}`);

  context.srcDir = resolve(context.srcDir || getConfigValue(context, '--srcDir', null, Constants.ENV_VAR_SRC_DIR, Constants.ENV_VAR_SRC_DIR.toLowerCase(), join(context.rootDir, Constants.SRC_DIR)));
  setProcessEnvVar(Constants.ENV_VAR_SRC_DIR, context.srcDir);
  Logger.debug(`srcDir set to ${context.srcDir}`);

  context.wwwDir = resolve(context.wwwDir || getConfigValue(context, '--wwwDir', null, Constants.ENV_VAR_WWW_DIR, Constants.ENV_VAR_WWW_DIR.toLowerCase(), join(context.rootDir, Constants.WWW_DIR)));
  setProcessEnvVar(Constants.ENV_VAR_WWW_DIR, context.wwwDir);
  Logger.debug(`wwwDir set to ${context.wwwDir}`);

  context.wwwIndex = getConfigValue(context, '--wwwIndex', null, Constants.ENV_VAR_HTML_TO_SERVE, Constants.ENV_VAR_HTML_TO_SERVE.toLowerCase(), 'index.html');
  setProcessEnvVar(Constants.ENV_VAR_HTML_TO_SERVE, context.wwwIndex);
  Logger.debug(`wwwIndex set to ${context.wwwIndex}`);

  context.buildDir = resolve(context.buildDir || getConfigValue(context, '--buildDir', null, Constants.ENV_VAR_BUILD_DIR, Constants.ENV_VAR_BUILD_DIR.toLowerCase(), join(context.wwwDir, Constants.BUILD_DIR)));
  setProcessEnvVar(Constants.ENV_VAR_BUILD_DIR, context.buildDir);
  Logger.debug(`buildDir set to ${context.buildDir}`);

  context.nodeModulesDir = join(context.rootDir, Constants.NODE_MODULES);
  setProcessEnvVar(Constants.ENV_VAR_NODE_MODULES_DIR, context.nodeModulesDir);
  Logger.debug(`nodeModulesDir set to ${context.nodeModulesDir}`);

  context.ionicAngularDir = resolve(context.ionicAngularDir || getConfigValue(context, '--ionicAngularDir', null, Constants.ENV_VAR_IONIC_ANGULAR_DIR, Constants.ENV_VAR_IONIC_ANGULAR_DIR.toLowerCase(), join(context.nodeModulesDir, Constants.IONIC_ANGULAR)));
  setProcessEnvVar(Constants.ENV_VAR_IONIC_ANGULAR_DIR, context.ionicAngularDir);
  Logger.debug(`ionicAngularDir set to ${context.ionicAngularDir}`);

  context.platform = getConfigValue(context, '--platform', null, Constants.ENV_VAR_PLATFORM, null, null);
  setProcessEnvVar(Constants.ENV_VAR_PLATFORM, context.platform);
  Logger.debug(`platform set to ${context.platform}`);

  context.target = getConfigValue(context, '--target', null, Constants.ENV_VAR_TARGET, null, null);
  setProcessEnvVar(Constants.ENV_VAR_TARGET, context.target);
  Logger.debug(`target set to ${context.target}`);

  const ionicAngularEntryPoint = resolve(getConfigValue(context, '--ionicAngularEntryPoint', null, Constants.ENV_VAR_IONIC_ANGULAR_ENTRY_POINT, Constants.ENV_VAR_IONIC_ANGULAR_ENTRY_POINT.toLowerCase(), join(context.ionicAngularDir, 'index.js')));
  setProcessEnvVar(Constants.ENV_VAR_IONIC_ANGULAR_ENTRY_POINT, ionicAngularEntryPoint);
  Logger.debug(`ionicAngularEntryPoint set to ${ionicAngularEntryPoint}`);

  const appScriptsDir = join(__dirname, '..', '..');
  setProcessEnvVar(Constants.ENV_VAR_APP_SCRIPTS_DIR, appScriptsDir);
  Logger.debug(`appScriptsDir set to ${appScriptsDir}`);

  const generateSourceMap = getConfigValue(context, '--generateSourceMap', null, Constants.ENV_VAR_GENERATE_SOURCE_MAP, Constants.ENV_VAR_GENERATE_SOURCE_MAP.toLowerCase(), context.isProd || context.runMinifyJs ? null : 'true');
  setProcessEnvVar(Constants.ENV_VAR_GENERATE_SOURCE_MAP, generateSourceMap);
  Logger.debug(`generateSourceMap set to ${generateSourceMap}`);

  const sourceMapTypeValue = getConfigValue(context, '--sourceMapType', null, Constants.ENV_VAR_SOURCE_MAP_TYPE, Constants.ENV_VAR_SOURCE_MAP_TYPE.toLowerCase(), Constants.SOURCE_MAP_TYPE_EXPENSIVE);
  setProcessEnvVar(Constants.ENV_VAR_SOURCE_MAP_TYPE, sourceMapTypeValue);
  Logger.debug(`sourceMapType set to ${sourceMapTypeValue}`);

  const tsConfigPathValue = resolve(getConfigValue(context, '--tsconfig', null, Constants.ENV_TS_CONFIG, Constants.ENV_TS_CONFIG.toLowerCase(), join(context.rootDir, 'tsconfig.json')));
  setProcessEnvVar(Constants.ENV_TS_CONFIG, tsConfigPathValue);
  Logger.debug(`tsconfig set to ${tsConfigPathValue}`);

  const readConfigJson = getConfigValue(context, '--readConfigJson', null, Constants.ENV_READ_CONFIG_JSON, Constants.ENV_READ_CONFIG_JSON.toLowerCase(), 'true');
  setProcessEnvVar(Constants.ENV_READ_CONFIG_JSON, readConfigJson);
  Logger.debug(`readConfigJson set to ${readConfigJson}`);

  const appEntryPointPathValue = resolve(getConfigValue(context, '--appEntryPoint', null, Constants.ENV_APP_ENTRY_POINT, Constants.ENV_APP_ENTRY_POINT.toLowerCase(), join(context.srcDir, 'app', 'main.ts')));
  setProcessEnvVar(Constants.ENV_APP_ENTRY_POINT, appEntryPointPathValue);
  Logger.debug(`appEntryPoint set to ${appEntryPointPathValue}`);

  const appNgModulePath = resolve(getConfigValue(context, '--appNgModulePath', null, Constants.ENV_APP_NG_MODULE_PATH, Constants.ENV_APP_NG_MODULE_PATH.toLowerCase(), join(context.srcDir, 'app', 'app.module.ts')));
  setProcessEnvVar(Constants.ENV_APP_NG_MODULE_PATH, appNgModulePath);
  Logger.debug(`appNgModulePath set to ${appNgModulePath}`);

  const appNgModuleClass = getConfigValue(context, '--appNgModuleClass', null, Constants.ENV_APP_NG_MODULE_CLASS, Constants.ENV_APP_NG_MODULE_CLASS.toLowerCase(), 'AppModule');
  setProcessEnvVar(Constants.ENV_APP_NG_MODULE_CLASS, appNgModuleClass);
  Logger.debug(`appNgModuleClass set to ${appNgModuleClass}`);

  const pathToGlobUtil = join(getProcessEnvVar(Constants.ENV_VAR_APP_SCRIPTS_DIR), 'dist', 'util', 'glob-util.js');
  setProcessEnvVar(Constants.ENV_GLOB_UTIL, pathToGlobUtil);
  Logger.debug(`pathToGlobUtil set to ${pathToGlobUtil}`);

  const cleanBeforeCopy = getConfigValue(context, '--cleanBeforeCopy', null, Constants.ENV_CLEAN_BEFORE_COPY, Constants.ENV_CLEAN_BEFORE_COPY.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_CLEAN_BEFORE_COPY, cleanBeforeCopy);
  Logger.debug(`cleanBeforeCopy set to ${cleanBeforeCopy}`);

  const closureCompilerJarPath = join(getProcessEnvVar(Constants.ENV_VAR_APP_SCRIPTS_DIR), 'bin', 'closure-compiler.jar');
  setProcessEnvVar(Constants.ENV_CLOSURE_JAR, closureCompilerJarPath);
  Logger.debug(`closureCompilerJarPath set to ${closureCompilerJarPath}`);

  const outputJsFileName = getConfigValue(context, '--outputJsFileName', null, Constants.ENV_OUTPUT_JS_FILE_NAME, Constants.ENV_OUTPUT_JS_FILE_NAME.toLowerCase(), 'main.js');
  setProcessEnvVar(Constants.ENV_OUTPUT_JS_FILE_NAME, outputJsFileName);
  Logger.debug(`outputJsFileName set to ${outputJsFileName}`);

  const outputJsMapFileName = getConfigValue(context, '--outputJsMapFileName', null, Constants.ENV_OUTPUT_JS_MAP_FILE_NAME, Constants.ENV_OUTPUT_JS_MAP_FILE_NAME.toLowerCase(), 'main.js.map');
  setProcessEnvVar(Constants.ENV_OUTPUT_JS_MAP_FILE_NAME, outputJsMapFileName);
  Logger.debug(`outputJsMapFileName set to ${outputJsMapFileName}`);

  const outputCssFileName = getConfigValue(context, '--outputCssFileName', null, Constants.ENV_OUTPUT_CSS_FILE_NAME, Constants.ENV_OUTPUT_CSS_FILE_NAME.toLowerCase(), 'main.css');
  setProcessEnvVar(Constants.ENV_OUTPUT_CSS_FILE_NAME, outputCssFileName);
  Logger.debug(`outputCssFileName set to ${outputCssFileName}`);

  const outputCssMapFileName = getConfigValue(context, '--outputCssMapFileName', null, Constants.ENV_OUTPUT_CSS_MAP_FILE_NAME, Constants.ENV_OUTPUT_CSS_MAP_FILE_NAME.toLowerCase(), 'main.css.map');
  setProcessEnvVar(Constants.ENV_OUTPUT_CSS_MAP_FILE_NAME, outputCssMapFileName);
  Logger.debug(`outputCssMapFileName set to ${outputCssMapFileName}`);

  const webpackFactoryPath = join(getProcessEnvVar(Constants.ENV_VAR_APP_SCRIPTS_DIR), 'dist', 'webpack', 'ionic-webpack-factory.js');
  setProcessEnvVar(Constants.ENV_WEBPACK_FACTORY, webpackFactoryPath);
  Logger.debug(`webpackFactoryPath set to ${webpackFactoryPath}`);

  const webpackLoaderPath = join(getProcessEnvVar(Constants.ENV_VAR_APP_SCRIPTS_DIR), 'dist', 'webpack', 'loader.js');
  setProcessEnvVar(Constants.ENV_WEBPACK_LOADER, webpackLoaderPath);
  Logger.debug(`webpackLoaderPath set to ${webpackLoaderPath}`);

  const optimizationLoaderPath = join(getProcessEnvVar(Constants.ENV_VAR_APP_SCRIPTS_DIR), 'dist', 'webpack', 'optimization-loader.js');
  setProcessEnvVar(Constants.ENV_OPTIMIZATION_LOADER, optimizationLoaderPath);
  Logger.debug(`optimizationLoaderPath set to ${optimizationLoaderPath}`);


  const aotWriteToDisk = getConfigValue(context, '--aotWriteToDisk', null, Constants.ENV_AOT_WRITE_TO_DISK, Constants.ENV_AOT_WRITE_TO_DISK.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_AOT_WRITE_TO_DISK, aotWriteToDisk);
  Logger.debug(`aotWriteToDisk set to ${aotWriteToDisk}`);

  const printOriginalDependencyTree = getConfigValue(context, '--printOriginalDependencyTree', null, Constants.ENV_PRINT_ORIGINAL_DEPENDENCY_TREE, Constants.ENV_PRINT_ORIGINAL_DEPENDENCY_TREE.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_PRINT_ORIGINAL_DEPENDENCY_TREE, printOriginalDependencyTree);
  Logger.debug(`printOriginalDependencyTree set to ${printOriginalDependencyTree}`);

  const printModifiedDependencyTree = getConfigValue(context, '--printModifiedDependencyTree', null, Constants.ENV_PRINT_MODIFIED_DEPENDENCY_TREE, Constants.ENV_PRINT_MODIFIED_DEPENDENCY_TREE.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_PRINT_MODIFIED_DEPENDENCY_TREE, printModifiedDependencyTree);
  Logger.debug(`printModifiedDependencyTree set to ${printModifiedDependencyTree}`);

  const printWebpackDependencyTree = getConfigValue(context, '--printWebpackDependencyTree', null, Constants.ENV_PRINT_WEBPACK_DEPENDENCY_TREE, Constants.ENV_PRINT_WEBPACK_DEPENDENCY_TREE.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_PRINT_WEBPACK_DEPENDENCY_TREE, printWebpackDependencyTree);
  Logger.debug(`printWebpackDependencyTree set to ${printWebpackDependencyTree}`);


  const bailOnLintError = getConfigValue(context, '--bailOnLintError', null, Constants.ENV_BAIL_ON_LINT_ERROR, Constants.ENV_BAIL_ON_LINT_ERROR.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_BAIL_ON_LINT_ERROR, bailOnLintError);
  Logger.debug(`bailOnLintError set to ${bailOnLintError}`);

  const enableLint = getConfigValue(context, '--enableLint', null, Constants.ENV_ENABLE_LINT, Constants.ENV_ENABLE_LINT.toLowerCase(), 'true');
  setProcessEnvVar(Constants.ENV_ENABLE_LINT, enableLint);
  Logger.debug(`enableLint set to ${enableLint}`);

  const disableLogging = getConfigValue(context, '--disableLogging', null, Constants.ENV_DISABLE_LOGGING, Constants.ENV_DISABLE_LOGGING.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_DISABLE_LOGGING, disableLogging);
  Logger.debug(`disableLogging set to ${disableLogging}`);

  /* Provider Path Stuff */
  setProcessEnvVar(Constants.ENV_ACTION_SHEET_CONTROLLER_CLASSNAME, 'ActionSheetController');
  setProcessEnvVar(Constants.ENV_ACTION_SHEET_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'action-sheet', 'action-sheet-controller.js'));
  setProcessEnvVar(Constants.ENV_ACTION_SHEET_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'action-sheet', 'action-sheet.js'));
  setProcessEnvVar(Constants.ENV_ACTION_SHEET_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'action-sheet', 'action-sheet-component.ngfactory.js'));

  setProcessEnvVar(Constants.ENV_ALERT_CONTROLLER_CLASSNAME, 'AlertController');
  setProcessEnvVar(Constants.ENV_ALERT_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'alert', 'alert-controller.js'));
  setProcessEnvVar(Constants.ENV_ALERT_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'alert', 'alert.js'));
  setProcessEnvVar(Constants.ENV_ALERT_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'alert', 'alert-component.ngfactory.js'));

  setProcessEnvVar(Constants.ENV_LOADING_CONTROLLER_CLASSNAME, 'LoadingController');
  setProcessEnvVar(Constants.ENV_LOADING_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'loading', 'loading-controller.js'));
  setProcessEnvVar(Constants.ENV_LOADING_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'loading', 'loading.js'));
  setProcessEnvVar(Constants.ENV_LOADING_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'loading', 'loading-component.ngfactory.js'));

  setProcessEnvVar(Constants.ENV_MODAL_CONTROLLER_CLASSNAME, 'ModalController');
  setProcessEnvVar(Constants.ENV_MODAL_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'modal', 'modal-controller.js'));
  setProcessEnvVar(Constants.ENV_MODAL_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'modal', 'modal.js'));
  setProcessEnvVar(Constants.ENV_MODAL_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'modal', 'modal-component.ngfactory.js'));

  setProcessEnvVar(Constants.ENV_PICKER_CONTROLLER_CLASSNAME, 'PickerController');
  setProcessEnvVar(Constants.ENV_PICKER_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'picker', 'picker-controller.js'));
  setProcessEnvVar(Constants.ENV_PICKER_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'picker', 'picker.js'));
  setProcessEnvVar(Constants.ENV_PICKER_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'picker', 'picker-component.ngfactory.js'));

  setProcessEnvVar(Constants.ENV_POPOVER_CONTROLLER_CLASSNAME, 'PopoverController');
  setProcessEnvVar(Constants.ENV_POPOVER_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'popover', 'popover-controller.js'));
  setProcessEnvVar(Constants.ENV_POPOVER_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'popover', 'popover.js'));
  setProcessEnvVar(Constants.ENV_POPOVER_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'popover', 'popover-component.ngfactory.js'));

  setProcessEnvVar(Constants.ENV_TOAST_CONTROLLER_CLASSNAME, 'ToastController');
  setProcessEnvVar(Constants.ENV_TOAST_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'toast', 'toast-controller.js'));
  setProcessEnvVar(Constants.ENV_TOAST_VIEW_CONTROLLER_PATH, join(context.ionicAngularDir, 'components', 'toast', 'toast.js'));
  setProcessEnvVar(Constants.ENV_TOAST_COMPONENT_FACTORY_PATH, join(context.ionicAngularDir, 'components', 'toast', 'toast-component.ngfactory.js'));

  /* Experimental Flags */
  const experimentalParseDeepLinks = getConfigValue(context, '--experimentalParseDeepLinks', null, Constants.ENV_EXPERIMENTAL_PARSE_DEEPLINKS, Constants.ENV_EXPERIMENTAL_PARSE_DEEPLINKS.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_EXPERIMENTAL_PARSE_DEEPLINKS, experimentalParseDeepLinks);
  Logger.debug(`experimentalParseDeepLinks set to ${experimentalParseDeepLinks}`);

  const experimentalManualTreeshaking = getConfigValue(context, '--experimentalManualTreeshaking', null, Constants.ENV_EXPERIMENTAL_MANUAL_TREESHAKING, Constants.ENV_EXPERIMENTAL_MANUAL_TREESHAKING.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_EXPERIMENTAL_MANUAL_TREESHAKING, experimentalManualTreeshaking);
  Logger.debug(`experimentalManualTreeshaking set to ${experimentalManualTreeshaking}`);

  const experimentalPurgeDecorators = getConfigValue(context, '--experimentalPurgeDecorators', null, Constants.ENV_EXPERIMENTAL_PURGE_DECORATORS, Constants.ENV_EXPERIMENTAL_PURGE_DECORATORS.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_EXPERIMENTAL_PURGE_DECORATORS, experimentalPurgeDecorators);
  Logger.debug(`experimentalPurgeDecorators set to ${experimentalPurgeDecorators}`);

  const useExperimentalClosure = getConfigValue(context, '--useExperimentalClosure', null, Constants.ENV_USE_EXPERIMENTAL_CLOSURE, Constants.ENV_USE_EXPERIMENTAL_CLOSURE.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_USE_EXPERIMENTAL_CLOSURE, useExperimentalClosure);
  Logger.debug(`useExperimentalClosure set to ${useExperimentalClosure}`);

  const useExperimentalBabili = getConfigValue(context, '--useExperimentalBabili', null, Constants.ENV_USE_EXPERIMENTAL_BABILI, Constants.ENV_USE_EXPERIMENTAL_BABILI.toLowerCase(), null);
  setProcessEnvVar(Constants.ENV_USE_EXPERIMENTAL_BABILI, useExperimentalBabili);
  Logger.debug(`useExperimentalBabili set to ${useExperimentalBabili}`);

  // default stand-alone builds to default to es5
  // if closure is being used, don't worry about this as it already automatically converts to ES5
  const buildToEs5 = getConfigValue(context, '--buildToEs5', null, Constants.ENV_BUILD_TO_ES5, Constants.ENV_BUILD_TO_ES5.toLowerCase(), useExperimentalClosure ? null : 'true');
  setProcessEnvVar(Constants.ENV_BUILD_TO_ES5, buildToEs5);
  Logger.debug(`buildToEs5 set to ${buildToEs5}`);

  if (!isValidBundler(context.bundler)) {
    context.bundler = bundlerStrategy(context);
    Logger.debug(`bundler set to ${context.bundler}`);
  }

  context.inlineTemplates = true;

  checkDebugMode();

  if (getBooleanPropertyValue(Constants.ENV_DISABLE_LOGGING)) {
    console.debug = () => { };
    console.error = () => { };
    console.info = () => { };
    console.log = () => { };
    console.trace = () => { };
    console.warn = () => { };
  }

  return context;
}

export function getUserConfigFile(context: BuildContext, task: TaskInfo, userConfigFile: string) {
  if (!context) {
    context = generateContext(context);
  }

  if (userConfigFile) {
    return resolve(userConfigFile);
  }

  const defaultConfig = getConfigValue(context, task.fullArg, task.shortArg, task.envVar, task.packageConfig, null);
  if (defaultConfig) {
    return join(context.rootDir, defaultConfig);
  }

  return null;
}


export function fillConfigDefaults(userConfigFile: string, defaultConfigFile: string): any {
  let userConfig: any = null;

  if (userConfigFile) {
    try {
      // check if exists first, so we can print a more specific error message
      // since required config could also throw MODULE_NOT_FOUND
      statSync(userConfigFile);
      // create a fresh copy of the config each time
      userConfig = require(userConfigFile);

      // if user config returns a function call it to determine proper object
      if (typeof userConfig === 'function') {
         userConfig = userConfig();
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.error(`Config file "${userConfigFile}" not found. Using defaults instead.`);
      } else {
        console.error(`There was an error in config file "${userConfigFile}". Using defaults instead.`);
        console.error(e);
      }
    }
  }

  const defaultConfig = require(join('..', '..', 'config', defaultConfigFile));

  // create a fresh copy of the config each time
  // always assign any default values which were not already supplied by the user
  return objectAssign({}, defaultConfig, userConfig);
}

export function bundlerStrategy(context: BuildContext): string {
  // 1) User provided a rollup config via cmd line args
  let val: any = getArgValue('--rollup', '-r');
  if (val) {
    return Constants.BUNDLER_ROLLUP;
  }

  // 2) User provided both a rollup config and webpack config in package.json config
  val = getPackageJsonConfig(context, 'ionic_rollup');
  const webpackVal = getPackageJsonConfig(context, 'ionic_webpack');
  if (val && webpackVal) {
    let bundler = getPackageJsonConfig(context, 'ionic_bundler');
    if (isValidBundler(bundler)) {
      return bundler;
    }
  }

  // 3) User provided a rollup config env var
  val = getProcessEnvVar('ionic_rollup');
  if (val) {
    return Constants.BUNDLER_ROLLUP;
  }

  // 4) User provided a rollup config in package.json config
  val = getPackageJsonConfig(context, 'ionic_rollup');
  if (val) {
    return Constants.BUNDLER_ROLLUP;
  }

  // 5) User set bundler through full arg
  val = getArgValue('--bundler', null);
  if (isValidBundler(val)) {
    return val;
  }

  // 6) User set bundler through package.json config
  val = getPackageJsonConfig(context, 'ionic_bundler');
  if (isValidBundler(val)) {
    return val;
  }

  // 7) User set to use rollup at the bundler
  val = getProcessEnvVar('ionic_bundler');
  if (isValidBundler(val)) {
    return val;
  }

  // 8) Default to use webpack
  return Constants.BUNDLER_WEBPACK;
}


function isValidBundler(bundler: any) {
  return (bundler === Constants.BUNDLER_ROLLUP || bundler === Constants.BUNDLER_WEBPACK);
}


export function getConfigValue(context: BuildContext, argFullName: string, argShortName: string, envVarName: string, packageConfigProp: string, defaultValue: string) {
  if (!context) {
    context = generateContext(context);
  }

  // first see if the value was set in the command-line args
  const argVal = getArgValue(argFullName, argShortName);
  if (argVal !== null) {
    return argVal;
  }

  // next see if it was set in the environment variables
  // which also checks if it was set in the package.json config property
  const envVar = getProcessEnvVar(envVarName);
  if (envVar !== null) {
    return envVar;
  }

  const packageConfig = getPackageJsonConfig(context, packageConfigProp);
  if (packageConfig !== null) {
    return packageConfig;
  }

  // return the default if nothing above was found
  return defaultValue;
}


function getArgValue(fullName: string, shortName: string): string {
  for (var i = 2; i < processArgv.length; i++) {
    var arg = processArgv[i];
    if (arg === fullName || (shortName && arg === shortName)) {
      var val = processArgv[i + 1];
      if (val !== undefined && val !== '') {
        return val;
      }
    }
  }
  return null;
}


export function hasConfigValue(context: BuildContext, argFullName: string, argShortName: string, envVarName: string, defaultValue: boolean) {
  if (!context) {
    context = generateContext(context);
  }

  if (hasArg(argFullName, argShortName)) {
    return true;
  }

  // next see if it was set in the environment variables
  // which also checks if it was set in the package.json config property
  const envVar = getProcessEnvVar(envVarName);
  if (envVar !== null) {
    return true;
  }

  const packageConfig = getPackageJsonConfig(context, envVarName);
  if (packageConfig !== null) {
    return true;
  }

  // return the default if nothing above was found
  return defaultValue;
}


export function hasArg(fullName: string, shortName: string = null): boolean {
  return !!(processArgv.some(a => a.toLowerCase() === fullName.toLowerCase()) ||
    (shortName !== null && processArgv.some(a => a.toLowerCase() === shortName.toLowerCase())));
}


export function replacePathVars(context: BuildContext, filePath: string | string[] | { [key: string]: any }): any {
  if (Array.isArray(filePath)) {
    return filePath.map(f => replacePathVars(context, f));
  }

  if (typeof filePath === 'object') {
    const clonedFilePaths = Object.assign({}, filePath);
    for (let key in clonedFilePaths) {
      clonedFilePaths[key] = replacePathVars(context, clonedFilePaths[key]);
    }
    return clonedFilePaths;
  }

  return filePath.replace('{{SRC}}', context.srcDir)
    .replace('{{WWW}}', context.wwwDir)
    .replace('{{TMP}}', context.tmpDir)
    .replace('{{ROOT}}', context.rootDir)
    .replace('{{BUILD}}', context.buildDir);
}

export function getNodeBinExecutable(context: BuildContext, cmd: string) {
  let cmdPath = join(context.rootDir, 'node_modules', '.bin', cmd);

  try {
    accessSync(cmdPath);
  } catch (e) {
    cmdPath = null;
  }

  return cmdPath;
}


let checkedDebug = false;
function checkDebugMode() {
  if (!checkedDebug) {
    if (hasArg('--debug') || getProcessEnvVar('ionic_debug_mode') === 'true') {
      processEnv.ionic_debug_mode = 'true';
    }
    checkedDebug = true;
  }
}


export function isDebugMode() {
  return (processEnv.ionic_debug_mode === 'true');
}

let processArgv: string[];
export function setProcessArgs(argv: string[]) {
  processArgv = argv;
}
setProcessArgs(process.argv);

export function addArgv(value: string) {
  processArgv.push(value);
}

let processEnv: any;
export function setProcessEnv(env: any) {
  processEnv = env;
}
setProcessEnv(process.env);

export function setProcessEnvVar(key: string, value: any) {
  if (key && value) {
    processEnv[key] = value;
  }
}

export function getProcessEnvVar(key: string): any {
  const val = processEnv[key];
  if (val !== undefined) {
    if (val === 'true') {
      return true;
    }
    if (val === 'false') {
      return false;
    }
    return val;
  }
  return null;
}

let processCwd: string;
export function setCwd(cwd: string) {
  processCwd = cwd;
}
setCwd(process.cwd());


export function getPackageJsonConfig(context: BuildContext, key: string): any {
  const packageJsonData = getAppPackageJsonData(context);
  if (packageJsonData && packageJsonData.config) {
    const val = packageJsonData.config[key];
    if (val !== undefined) {
      if (val === 'true') {
        return true;
      }
      if (val === 'false') {
        return false;
      }
      return val;
    }
  }
  return null;
}


let appPackageJsonData: any = null;
export function setAppPackageJsonData(data: any) {
  appPackageJsonData = data;
}

function getAppPackageJsonData(context: BuildContext) {
  if (!appPackageJsonData) {
    try {
      appPackageJsonData = readJSONSync(join(context.rootDir, 'package.json'));
    } catch (e) {}
  }

  return appPackageJsonData;
}
