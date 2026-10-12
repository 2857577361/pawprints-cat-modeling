const {app,BrowserWindow,ipcMain,dialog,protocol,net,Menu,shell}=require('electron');
const path=require('node:path');const {pathToFileURL}=require('node:url');const {Library}=require('./library.cjs');
app.setName('爪印');if(process.env.PAWPRINTS_USER_DATA)app.setPath('userData',process.env.PAWPRINTS_USER_DATA);protocol.registerSchemesAsPrivileged([{scheme:'paw-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
let win,library;let queue=Promise.resolve();const serial=fn=>{const task=queue.then(fn,fn);queue=task.catch(()=>{});return task;};
function checkSender(event){if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame)throw new Error('未授权的窗口');}
const handle=(name,fn)=>ipcMain.handle(name,(e,...args)=>{checkSender(e);return serial(()=>fn(...args));});
function createWindow(){win=new BrowserWindow({width:1512,height:980,minWidth:1100,minHeight:760,backgroundColor:'#faf9f4',titleBarStyle:'hiddenInset',trafficLightPosition:{x:23,y:21},webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,preload:path.join(__dirname,'preload.cjs')}});win.loadFile(path.join(__dirname,'../dist/index.html'));win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(url!==win.webContents.getURL())e.preventDefault();});}
app.whenReady().then(async()=>{
 try{const domain=await import(pathToFileURL(path.join(__dirname,'../src/domain.js')).href);library=new Library(path.join(app.getPath('userData'),'library'),path.join(__dirname,'../dist/seed'),domain);await library.init();
 protocol.handle('paw-media',async request=>{try{const u=new URL(request.url);if(u.hostname!=='file')return new Response('Not found',{status:404});const p=await library.filePath(decodeURIComponent(u.pathname.slice(1)));return net.fetch(pathToFileURL(p).href,{headers:request.headers});}catch{return new Response('Not found',{status:404});}});
 handle('library:load',()=>library.load());handle('library:save',state=>library.save(state));
 handle('library:import',async()=>{const r=await dialog.showOpenDialog(win,{title:'收录猫咪的照片与视频',properties:['openFile','multiSelections'],filters:[{name:'照片与视频',extensions:['jpg','jpeg','png','webp','gif','avif','mp4','webm','mov','m4v']}]});return r.canceled?[]:library.importFiles(r.filePaths);});
 handle('library:backup',async()=>{const r=await dialog.showOpenDialog(win,{title:'选择备份保存位置',properties:['openDirectory','createDirectory']});if(r.canceled)return {canceled:true};return {ok:true,path:await library.backup(r.filePaths[0])};});
 handle('library:restore',async()=>{const r=await dialog.showOpenDialog(win,{title:'选择爪印备份文件夹',properties:['openDirectory']});if(r.canceled)return {canceled:true};return library.restore(r.filePaths[0]);});
 handle('library:open',async id=>shell.openPath(await library.filePath(id)));
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'爪印',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'窗口',submenu:[{role:'minimize'},{role:'togglefullscreen'}]}]));
 createWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
 }catch(e){dialog.showErrorBox('相册暂时无法打开',`${e.message}\n原有资料未被重置。请保留应用数据后重试。`);app.quit();}
});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
