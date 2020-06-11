/*jshint esversion: 8, asi: true */

const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const express = require('express');
const bodyParser = require('body-parser');

import csInterface from './CSInterface.js';
import Vulcan from './Vulcan.js';
import { type } from 'os';
const cs = new CSInterface();
var v = new Vulcan();
let devName = 'BattleAxe';
let scriptName = getExtName().replace(' ', '');

export default {
    configure(props) {
        devName = props.devName || devName,
        scriptName = props.scriptName || scriptName
    },
    userPath() {
        return `${cs.getSystemPath(SystemPath.USER_DATA)}/${devName}/${scriptName}/`
    },
    checkPath(targetDir) {
        try {
            let checkPath = shell.mkdir('-p', targetDir);
            return checkPath
        } catch (error) {
            console.log(error);
        }
    },
    popup(msg) {
        if (!msg) { msg = '' }
        msg = msg.replace('\n', '\\n')
        console.log(msg);
        let script = `alert("${msg}")`;

        cs.evalScript(script)
    },
    confirmDialog(opt) {
        let _opt = opt || {}
        let options = {
            header: _opt.header || 'This is the header',
            msg: _opt.msg || 'Here is the message within a dialog box',
            btnConfirm: _opt.btnConfirm || 'OK',
            btnCancel: _opt.btnCancel || 'Cancel'
        }

        let script = `(function () {
            var overwriteFile = false
            dialog()
            return overwriteFile


            function dialog () {
                var w = new Window('dialog', '${options.header}' );

                var messageText = w.add('statictext', undefined, '${options.msg}', { multiline: true })
                messageText.preferredSize.width = 300;

                var buttonGroup = w.add('group {alignment: "right"}');
                buttonGroup.add('button', undefined, '${options.btnCancel}', { name: 'cancel' })
                var savePath = buttonGroup.add('button', undefined, '${options.btnConfirm}', { name: 'ok' });

                savePath.onClick = function () {
                    w.close();
                    overwriteFile = true
                };

                w.show();
            }
        }) ()`

        return new Promise((resolve, reject) => {
            cs.evalScript(script, res => {
                if (res) { resolve(JSON.parse(res)) }
            })
        })
    },
    folderOpenDialog(headerText, filePath) {
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

        if (filePath) {         
            return new Promise((resolve, reject) => {
                if (resolve) { resolve(filePath) }
            })
        } else {
            return new Promise((resolve, reject) => {
                cs.evalScript(script, resolve);
            })
        }
    },
    fileSaveDialog(headerText) {
        if (!headerText) { headerText = '' }
        let script = `
            (function () {
                var filePath = File.saveDialog(['${headerText}']);
                var fileName = File.decode(filePath.name)
                if (filePath) {
                    return JSON.stringify({
                            path: File.decode(filePath.path),
                            name: fileName.substr(0, fileName.lastIndexOf('.')) || fileName,
                            ext: fileName.split('.').pop() || null,
                        })
                } else {
                    return null;
                }
            }) ()
        `;

        return new Promise((resolve, reject) => {
            cs.evalScript(script, res => {
                if (res) { resolve(JSON.parse(res)) }
            })
        })
    },
    fileOpenDialog(headerText) {
        if (!headerText) { headerText = '' }
        let script = `
            (function () {
                var filePath = File.openDialog(['${headerText}']);
                var fileName = File.decode(filePath.name)
                var userFile = new File(filePath)
                userFile.open('r')
                var fileData = userFile.read()
                userFile.close()

                if (filePath) {
                    return JSON.stringify({
                        path: File.decode(filePath.absoluteURI),
                        name: fileName.substr(0, fileName.lastIndexOf('.')) || fileName,
                        ext: fileName.split('.').pop() || null,
                        data: fileData,
                    });
                } else {
                    return null;
                }
            }) ()
        `;

        return new Promise((resolve, reject) => {
            cs.evalScript(script, res => {
                if (res) { resolve(JSON.parse(res)) }
            })
        })
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
                var folderPath = Folder(aeProjFolder.toString() + '/' + '${relPath}');
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
            adobePath = adobePath.replace('/./', '/');       // remove ./ 
            
            if (adobePath.charAt(0) !== '~' && 
                adobePath.substring(0, 6) !== '/Users') { adobePath = '/Volumes' + adobePath }	                // append /Volumes to filepath if not on the local drive
            else if (adobePath.substring(0,2) == '~/') { 
                var homedir = path.join(cs.getSystemPath(SystemPath.USER_DATA), '/../../');
                adobePath = adobePath.replace('~/', homedir);
            }
        } else {        // windows
            if (adobePath.substring(0, 9) == '/Volumes/') {                                    // windows drive letter
                var drivePath = adobePath.replace('/Volumes/', '');                            // remove /Volumes/
                adobePath = drivePath.slice(0,1) + ':' + drivePath.slice(1);                   // add a colon after the drive letter - f/ becomes f:/
            }
            else if ( (/^\/./).test( adobePath )) {                                                  // windows drive letter
                var drivePath = adobePath;                                                     // remove /Volumes/
                adobePath = drivePath.slice(1,2) + ':' + drivePath.slice(2);                   // add a colon after the drive letter - f/ becomes f:/
            }
            else if (adobePath.substring(0, 2) == '~/') {                                      // starts with ~
                var homedir = path.join(cs.getSystemPath(SystemPath.USER_DATA), '/../../');
                adobePath = adobePath.replace('~/', homedir);
            }
        }
        console.log('adobePath', adobePath);
        
        return adobePath;
    },
    getPrefs(preferences, opt) {
        console.log('get prefs');
        
        const userPath = this.userPath()

        let prefs = preferences || {}
        let _opt = opt || {}
        let options = {
            folderName: _opt.folderName || 'config',
            fileName: _opt.fileName || 'prefs',
        }
        
        try {
            return new Promise((resolve, reject) => {
                fs.readFile(`${userPath}${options.folderName}/${options.fileName}.json`, 'utf8', (err, data) => {
                    if (err) {
                        console.log('cant read prefs file');
                        this.savePrefs(prefs)
                        resolve(prefs)
                        // reject(err)
                    } else {                        
                        let filePrefs = JSON.parse(data)
                        let ret = loopThruObj(prefs, filePrefs)
                        // console.log(ret);
                        
                        resolve(ret)                        
                        // this.savePrefs(ret)
                    }
                })
            })
        } catch (error) {            
            console.log('error getting prefs', error)
            return null;
        }
        function loopThruObj(prefs, ret) {
            let prefsArr = (prefs && typeof prefs == 'object') ? Object.entries(prefs) : prefs        // convert obj to array
            // console.log('prefsArr', prefsArr);
            if (!prefsArr) { return ret }
            
            prefsArr.forEach(element => {               // loop through top level of obj
                let key = element[0]

                if (ret[key] === undefined) {       // cant find this prefs prop so add it
                    ret[key] = element[1]
                } else if (typeof element[1] == 'object') {
                    console.log('element[1]', element[1]);
                    ret[key] = loopThruObj(element[1], ret[key])
                }
            })
            return ret
        }
    },
    savePrefs(data, opt) {        
        let _opt = opt || {}        
        let options = {
            folderName: _opt.folderName || 'config',
            fileName: _opt.fileName || 'prefs',
        }

        let folderPath = `${ this.userPath() }${ options.folderName }/`        
        this.checkPath(folderPath)
        setTimeout(() => {
            window.cep.fs.writeFile(`${folderPath}${options.fileName}.json`, JSON.stringify(data, false, 2))
        }, 50)
    },
    exportJsonFile(data, opt) {
        let _opt = opt || {}
        let options = {
            header: _opt.header || 'Save JSON file',
            ext: _opt.ext || 'json'
        }

        let header = options.header
        this.fileSaveDialog(header)
        .then(file => {            
            let fileName = file.name.split('.').slice(0, -1).join('.') || file.name
            let ext = options.ext || defaultOptions.ext
            return {
                path: this.untildify(file.path),
                name: `${ fileName }.${ ext }`
            }
        })
        .then(file => {
            let filePath = `${file.path}/${file.name}`
            if (fs.existsSync(filePath)) {
                let options = {
                    header: ' ',
                    msg: 'This file already exists. Would you like to overwrite it?',
                    btnConfirm: 'Overwrite',
                }
                this.confirmDialog(options)
                .then(overwriteFile => {
                    if (overwriteFile) {
                        window.cep.fs.writeFile(`${file.path}/${file.name}`, JSON.stringify(data, false, 2))
                    }
                })
            } else {
                window.cep.fs.writeFile(`${file.path}/${file.name}`, JSON.stringify(data, false, 2))
            }
            
            
        })
        .catch(error => {
            console.log("Looks like there was a problem:", error);
        })
    },
    reload() {
        console.log('reload');
        
        window.location.reload()
    },
    evalScript(funcName, params) {        
        let args = JSON.stringify(params)
        if (typeof args === "undefined" || args === "{}") {
            args = ""
        }
        let command = `${scriptName}.${funcName}(${args})`
        console.log(command);
        
        return new Promise((resolve, reject) => {
            cs.evalScript(command, res => {
                if (res && res != 'undefined') { resolve(JSON.parse(res)) }
            })
        })
    },
    evalString(script) {
        return new Promise((resolve, reject) => {
            cs.evalScript(script, resolve);
        });
    },
    bridgeTalk(host, script) {
        try {
        let hostScript = `"${script.replace(/\n\s*/g, '\n').split('\n').join('')}"`
        // alert(hostScript)
        cs.evalScript(
            // `var script = "fl.createDocument('timeline'); var doc = fl.getDocumentDOM(); doc.width = ${compData.width}; doc.height = ${compData.height}; doc.frameRate = ${compData.frameRate}; doc.backgroundColor = '${colorArrayToHex(compData.bgColor)}'; doc.zoomFactor = 0.1; doc.zoomFactor = 0.5;"
            `var bt = new BridgeTalk();
            bt.target = "${host}";
            bt.body = ${hostScript};
            bt.send();`
        )
        this.switchApps(host)
        } catch (e) {
            alert(e)
        }
    },
    switchApps(app) {
        var appName = new RegExp(app + '-\\d');
        var adobeApps = v.getTargetSpecifiers();
        var currentApp;

        // find a running version of app
        for (var i = 0; i < adobeApps.length; i++) {
            if (adobeApps[i].search(appName) != -1) {
                currentApp = adobeApps[i];
                if ( v.isAppRunning(currentApp) ) {
                    v.launchApp(currentApp, true);
                }
            }
        }
    },
    newServer(port) {
        const PORT = port || "3200";

        const app = express()
        app.use(bodyParser.json({ limit: '200mb' }));
        app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));

        app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        })

        app.post('/evalScript', (req, res) => {
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
                this.getPrefs()
                .then(prefs => { 
                    data.prefs = prefs                     
                })
                .then(() => {
                    this.evalScript(msg.method, data)
                    .then((returnMsg) => {
                        res.send(returnMsg)
                    })
                    .catch(error => {
                        console.log("Looks like there was a problem:", error);
                        res.status(400).send(error)
                    })
                })
            } else {
                this.evalScript(msg.method, data)
                .then((returnMsg) => {
                    res.send(returnMsg)
                })
                .catch(error => {
                    console.log("Looks like there was a problem:", error);
                    res.status(400).send(error)
                })
            }
            
        })
        app.post('/writeFiles', (req, res) => {
            let msg = req.body
            console.log(msg);            

            // switch to adobe app
            if (msg.switch) {
                this.switchApps(msg.switch)
            }
            setTimeout(() => {

            this.folderOpenDialog('Select where to save files')
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

                    let savePath = `${folderPath}/${fileName}`

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

            }, 1500);
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
            if (!res.ok) {
                throw new Error('Network response was not ok');
            }
            returnedMsg = res.json()            
            return returnedMsg
        })
        .then(msg => console.log(msg))
        .catch(error => {
            console.log("Looks like there was a problem:", error);
        })

        return returnedMsg
    },
    openUserFolder(folderPath) {
        cs.evalScript(`Folder('${this.userPath()}${folderPath}').execute()`)
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
    },
    openExtension(name) {
        cs.requestOpenExtension(name)
    },
    closeExtension() {
        cs.closeExtension()
    },
    // vulcanListener(vulcanId, msgList) {
    //     VulcanInterface.addMessageListener( VulcanMessage.TYPE_PREFIX + vulcanId, message => {
    //         var vMsg = JSON.parse(VulcanInterface.getPayload(message))
    //         console.log(vMsg);
            
    //         msgList.forEach(msg => {
    //             if (vMsg.cmd == msg.cmd) {
    //                 msg.action
    //             }
    //         })
    //     })
    // },
    // newVulcanMessage(vulcanId, message) {   
    //     console.log(VulcanMessage.TYPE_PREFIX);
           
    //     // var ccMessage = new VulcanMessage(VulcanMessage.TYPE_PREFIX + vulcanId);
    //     // ccMessage.setPayload(JSON.stringify(message));
    //     // VulcanInterface.dispatchMessage(ccMessage);
    // },
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

// function newVulcanMessage(message) {
//     var ccMessage = new VulcanMessage (VulcanMessage.TYPE_PREFIX + "scriptName");
//         ccMessage.setPayload(JSON.stringify(message));
//     VulcanInterface.dispatchMessage(ccMessage);
// }