const fs = require('fs');
const { Server } = require('ssh2');
const base = process.argv[2];
const server = new Server({ hostKeys: [fs.readFileSync(base+'/ssh-host-key')] }, client => {
  client.on('error', () => {});
  client.on('authentication', context => context.accept());
  client.on('ready', () => client.on('session', accept => {
    const session = accept();
    session.on('exec', (accept, reject, info) => {
      fs.appendFileSync(base+'/ssh-requests.log',info.command+'\n');
      const stream = accept();
      const row = JSON.parse(fs.readFileSync(base+'/gerrit-row.json'));
      stream.write(JSON.stringify(row)+'\n'+JSON.stringify({type:'stats',rowCount:1,moreChanges:false})+'\n');
      stream.exit(0); stream.end();
    });
  }));
});
server.listen(0,'127.0.0.1', () => fs.writeFileSync(base+'/ssh-port',String(server.address().port)));
process.on('SIGTERM',() => {server.close();process.exit(0)});
