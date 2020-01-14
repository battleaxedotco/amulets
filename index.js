/*jshint esversion: 6, asi: true */

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

import csInterface from './CSInterface.js';
import Vulcan from './Vulcan.js';
const cs = new CSInterface();
var v = new Vulcan();
let devName = 'BattleAxe';
let scriptName = getExtName().replace(' ', '');

export default {
    options(props) {
        devName = props.devName || devName,
        scriptName = props.scriptName || scriptName
    },
    userPath() {
        const devPath = cs.getSystemPath(SystemPath.USER_DATA) + '/' + devName + '/';
        return devPath + scriptName + '/';
    },
    checkPath(targetDir) {
        mkDirByPathSync(targetDir)

        function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
            const sep = path.sep;
            const initDir = path.isAbsolute(targetDir) ? sep : '';
            const baseDir = isRelativeToScript ? __dirname : '.';
          
            return targetDir.split(sep).reduce((parentDir, childDir) => {
              const curDir = path.resolve(baseDir, parentDir, childDir);
              try {
                fs.mkdirSync(curDir);
              } catch (err) {
                if (err.code === 'EEXIST') { // curDir already exists!
                  return curDir;
                }
          
                // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
                if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
                  throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
                }
          
                const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
                if (!caughtErr || caughtErr && curDir === path.resolve(targetDir)) {
                  throw err; // Throw if it's just the last created dir.
                }
              }
          
              return curDir;
            }, initDir);
        }
    },
    popup(msg) {
        if (!msg) { msg = '' }
        // let dump = 'Timelord says:\nHello butt'
        // let script = 'alert("' +dump+ '")';
        // let script = 'alert("' +msg+ '")';
        
        let script = `alert("${msg}")`;

        cs.evalScript(script)
    },
    folderDialog(headerText) {
        if (!headerText) { headerText = '' }
        let script = `
            (function () {
                var folderPath = Folder.selectDialog(['${headerText}']);
                if (folderPath) {
                    return Folder.decode(folderPath.absoluteURI);
                } else {
                    return null;
                }
            }) ()
        `;

        return new Promise((resolve, reject) => {
            cs.evalScript(script, resolve);
        });
    },
    fileDialog(headerText) {
        if (!headerText) { headerText = '' }
        let script = `
            (function () {
                var filePath = File.openDialog(['${headerText}']);
                if (filePath) {
                    return File.decode(filePath.absoluteURI);
                } else {
                    return null;
                }
            }) ()
        `;

        return new Promise((resolve, reject) => {
            cs.evalScript(script, resolve);
        });
    },
    openPath(path) {
        let script = `
            (function () {
                var folderPath = Folder('${path}');
                folderPath.execute();
            }) ()
        `;

        return new Promise((resolve, reject) => {
            cs.evalScript(script, resolve);
        });
    },
    openPathRelativeToProj(relPath) {
        // currently AE only
        let script = `
            (function () {
                if (!app.project.file) {
                    alert('Ooops. Save your project file first.');
                    return;
                }

                var aeProjFolder = app.project.file.parent;

                var folderPath = Folder(aeProjFolder + '${path}');
                folderPath.execute();
            }) ()
        `;

        return new Promise((resolve, reject) => {
            cs.evalScript(script, resolve);
        });
    },
    untildify(adobePath) {        
        if (adobePath == 'null') { return null }        // dialog canceled
        else if ( (cs.getOSInformation().substring(0, 3) == 'Mac') ) {                           // mac
            
            if (adobePath.charAt(0) !== '~') { adobePath = '/Volumes' + adobePath }	                // append /Volumes to filepath if not on the local drive
            if (adobePath.substring(0,2) == '~/') { 
                var homedir = path.join(cs.getSystemPath(SystemPath.USER_DATA), '/../../');
                adobePath = adobePath.replace('~/', homedir);
            }
        } else {        // windows
            if (adobePath.substring(0, 9) == '/Volumes/') {                                    // windows drive letter
                var drivePath = adobePath.replace('/Volumes/', '');                            // remove /Volumes/
                adobePath = drivePath.slice(0,1) + ':' + drivePath.slice(1);                   // add a colon after the drive letter - f/ becomes f:/
            }
            if ( (/^\/./).test(adobePath )) {                                                  // windows drive letter
                var drivePath = adobePath;                                                     // remove /Volumes/
                adobePath = drivePath.slice(1,2) + ':' + drivePath.slice(2);                   // add a colon after the drive letter - f/ becomes f:/
            }
        }

        return adobePath;
    },
    getPrefs(prefs) {
        const userPath = this.userPath();
        console.log(userPath);
        
        try {
            let readPrefs = fs.readFileSync(userPath + 'config/prefs.json', 'utf8');
            let parsePrefs = JSON.parse(readPrefs)

            let prefsData = parsePrefs
            
            updatePrefs(prefs)
            console.log(prefsData);
            
            return prefsData;

            // append prefs to the prefs obj even if they aren't in the prefs file
            function updatePrefs(prefs) {
                for (const key in prefs) {
                    if (prefs.hasOwnProperty(key)) {
                        prefsData[key] = (parsePrefs[key] !== undefined) ? parsePrefs[key] : prefs[key]
                    }
                }
            }
        } catch (error) {
            console.log('error');
            
            if (prefs) {
                this.savePrefs(prefs);
                return prefs;
            } else {
                return null;
            }          
        }
    },
    savePrefs(prefs) {
        let prefsPath = this.userPath() + 'config/';
        this.checkPath(prefsPath);
        setTimeout(() => {
            window.cep.fs.writeFile(prefsPath + 'prefs.json', JSON.stringify(prefs, false, 2));
        }, 100);
    },
    reload() {
        console.log('reload');
        
        window.location.reload()
    },
    evalScript(funcName, params) {        
        var args = JSON.stringify(params);
        if (typeof args === "undefined" || args === "{}") {
            args = "";
        }
        var command = scriptName + '.' + funcName + '(' + args + ')';
        return new Promise(function(resolve, reject) {
            cs.evalScript(command, resolve);
        });
    },
    evalString(script) {
        return new Promise((resolve, reject) => {
            cs.evalScript(script, resolve);
        });
    },
    switchApps(app) {
        var appName = new RegExp(app + '-\\d');
        var adobeApps = v.getTargetSpecifiers();
        var currentApp;
        var runningApp = false;

        // find the newest version unless one earlier is running
        for (var i = 0; i < adobeApps.length; i++) {
            if (adobeApps[i].search(appName) != -1 && !runningApp) {
                currentApp = adobeApps[i];
                runningApp = v.isAppRunning(currentApp) ? true : false;
            }
        }

        v.launchApp(currentApp, true);
        // console.log(currentApp);
    },
    newServer(port) {
        const PORT = port || "3200";

        const app = express()
        // app.use(express.json({ limit: "50mb" }) )
        // app.use(express.json() )
        app.use(bodyParser.json({ limit: '50mb' }));
        app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

        app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        })
        // app.use(bodyParser.json({ limit: '50mb' }));
        // app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

        app.post('/evalscript', (req, res) => {
            let msg = req.body
            let data = msg.data
            // no method name requested
            if (!msg.method) {
                res.status(400).send('A method is required')
            }
            // switch to adobe app
            if (msg.switch) {
                this.switchApps(msg.switch)
            }
            // switch to adobe app
            if (msg.getPrefs) {
                let prefs = this.getPrefs()
                data.prefs = prefs
                // this.switchApps(msg.switch)
            }
            
            this.evalScript(msg.method, data)
            .then((returnMsg) => {
                res.send(returnMsg)
            })
            .catch(error => {
                console.log("Looks like there was a problem:", error);
                alert('bug')
                res.status(400).send(error)
            })
        })
        app.post('/writeFiles', (req, res) => {
            let msg = req.body

            // switch to adobe app
            if (msg.switch) {
                this.switchApps(msg.switch)
            }

            this.folderDialog('Select where to save files')
            .then(adobePath => {
                return this.untildify(adobePath)
            })
            .then(folderPath => {
                let images = msg.images;
                let fileNames = []

                images.forEach(image => {
                    let data = image.imgData
                    let fileName = image.name
                    fileNames.push(fileName)

                    let savePath = folderPath + '/' + fileName

                    fs.writeFileSync(decodeURI(savePath), data, 'base64', function(err) {
                        console.log(err);
                    });
                });
                return folderPath
            })
            .then((returnMsg) => {
                res.send(JSON.stringify({path: returnMsg}))
            })
            .catch(error => {
                console.log("Looks like there was a problem:", error);
                res.status(400).send(error)
            })
        })

        app.listen(PORT, () => console.log(`Amulets server listening on port ${PORT}`))
    },
    async newMessage(port, msg) {
        const PORT = port || "3200";
        const HOST = "127.0.0.1";
        let returnedMsg = null;

        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        await fetch(`http://${HOST}:${PORT}/evalscript`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(msg)
        })
        .then(res => {
            returnedMsg = res.json()            
            return returnedMsg
        })
        .then(msg => console.log(msg))
        .catch(error => {
            console.log("Looks like there was a problem:", error);
        })

        return returnedMsg
    },
    openUserFolder(path) {
        let configPath = this.userPath() + path;
        cs.evalScript("Folder('"+ configPath +"').execute()")
    },
    webLink(url) {
        if (!url) { url = 'http://google.com'}
        cs.openURLInDefaultBrowser(url);
    },
    photoshopPersistent() {
        var extId = window.__adobe_cep__.getExtensionId(); 
        /// photoshop persistence
        var event = new CSEvent("com.adobe.PhotoshopPersistent", "APPLICATION");
        event.extensionId = extId;
        cs.dispatchEvent(event);
    }
}

function getExtName() {
    var extId = window.__adobe_cep__.getExtensionId();        
    if (extId.split('.').pop() == 'hidden') { return 'fallbackName' }
    var extName = null;
    
    var exts = JSON.parse(window.__adobe_cep__.getExtensions());
    for (var i = 0; i < exts.length; i++) {
        var ext = exts[i];
        if (ext.id == extId) {
            extName = ext.name;
            break;
        }
    }
    return extName.replace(' ', '');
}

function newVulcanMessage(message) {
    var ccMessage = new VulcanMessage (VulcanMessage.TYPE_PREFIX + "scriptName");
        ccMessage.setPayload(JSON.stringify(message));
    VulcanInterface.dispatchMessage(ccMessage);
}