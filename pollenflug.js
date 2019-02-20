/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const utils = require('@iobroker/adapter-core');
const dwd = require(__dirname + '/lib/dwd');
const request = require('request-promise-native');
const adapterName = require('./package.json').name.split('.').pop();
const adapterNodeVer = require('./package.json').engines.node;
const semver = require('semver');

let adapter;

function startAdapter(options) {
  options = options || {};
  options.name = adapterName;
  adapter = new utils.Adapter(options);

  // *****************************************************************************************************
  // is called when adapter shuts down - callback has to be called under any circumstances!
  // *****************************************************************************************************
  adapter.on('unload', async (callback) => {
    try {
      adapter.log.info('Closing Adapter');
      callback();
    } catch (e) {
      // adapter.log.error('Error');
      callback();
    }
  });

  // *****************************************************************************************************
  // Listen for sendTo messages
  // *****************************************************************************************************
  adapter.on('message', async (msg) => {

  });

  // *****************************************************************************************************
  // is called when databases are connected and adapter received configuration.
  // start here!
  // *****************************************************************************************************
  adapter.on('ready', async () => {
    await main();
  });
  return adapter;
}


async function createObjects(content) {
  try {
    if (content) {
      for (let i in content) {
        let entry =  content[i];
        let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
        let partregion_name = entry.partregion_id != -1  ? entry.region_name + ' - ' + entry.partregion_name : entry.region_name;
        let deviceid = adapter.namespace + '.region#' + partregion_id;
        await adapter.setObjectNotExistsAsync(deviceid, {
          type: 'device',
          common: {
            name: partregion_name
          }
        });
        for(let j in entry.Pollen) {
          let pollen = entry.Pollen[j];
          let channelid = deviceid + '.' + j;
          await adapter.setObjectNotExistsAsync(channelid, {
            type: 'channel',
            common: {
              name: j
            }
          });
          for(let k in pollen) {
            let riskindex = pollen[k];
            let stateid = channelid + '.' + k;
            await adapter.setObjectNotExistsAsync(stateid, {
              type: 'state',
              common: {
                name: k,
                type: 'number'
              },
              native: {}
            });
            // await adapter.setStateAsync(stateid, {val: riskindex, ack: true} );
          }
        }
      }
    }
  } catch (error) {
    adapter.log.error('Error creating Objects');
  }
}

async function setStates(content) {
  try {
    if (content) {
      for (let i in content) {
        let entry =  content[i];
        let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
        let deviceid = adapter.namespace + '.region#' + partregion_id;
        for(let j in entry.Pollen) {
          let channelid = deviceid + '.' + j;
          let pollen = entry.Pollen[j];
          for(let k in pollen) {
            let riskindex = pollen[k];
            let stateid = channelid + '.' + k;
            await adapter.setStateAsync(stateid, {val: riskindex, ack: true} );
          }
        }
      }
    }
  } catch (error) {
    adapter.log.error('Error set State');
  }
}


function getPollenflugForRegion(data, region) {
  let dataregion = [];
  if (data && data.content) {
    let content = data.content;
    for (let i in content) {
      if (!region || region == '*' || content[i].region_id == region) {
        dataregion.push(content[i]);
      }
    }
  }
  return dataregion;
}

async function pollenflugRequest() {
  let result;
  let url = 'https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json';
  try {
    result = await request(url, { method: 'GET', json: true });
  } catch (error) {
    adapter.log.error('Error requesting URL ' + url);
  }
  return result;
}

// *****************************************************************************************************
// Main
// *****************************************************************************************************
async function main() {
  adapter.log.info('Starting Adapter ' + adapter.namespace + ' in version ' + adapter.version);
  if (!semver.satisfies(process.version, adapterNodeVer)) {
    adapter.log.error(`Required node version ${adapterNodeVer} not satisfied with current version ${process.version}.`);
    setTimeout(() => adapter.stop());
  }

  let result = await pollenflugRequest();
  let content = getPollenflugForRegion(result, adapter.config.region);
  await createObjects(content);
  await setStates(content);
  adapter.log.info(JSON.stringify(content));
}

// If started as allInOne mode => return function to create instance
if (typeof module !== 'undefined' && module.parent) {
  module.exports = startAdapter;
} else {
  // or start the instance directly
  startAdapter();
}