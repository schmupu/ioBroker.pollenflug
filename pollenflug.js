/* jshint -W097 */
/* jshint -W030 */
/* jshint strict:true */
/* jslint node: true */
/* jslint esversion: 6 */
'use strict';

const utils = require('@iobroker/adapter-core');
const request = require('request-promise-native');
const adapterName = require('./package.json').name.split('.').pop();
const adapterNodeVer = require('./package.json').engines.node;
const semver = require('semver');

let systemLanguage;
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
    adapter.log.info('Starting Adapter ' + adapter.namespace + ' in version ' + adapter.version);
    if (!semver.satisfies(process.version, adapterNodeVer)) {
      adapter.log.error(`Required node version ${adapterNodeVer} not satisfied with current version ${process.version}.`);
      setTimeout(() => adapter.stop());
    }
    let obj = await adapter.getForeignObjectAsync('system.config');
    systemLanguage = (obj.common.language).toUpperCase();
    await main();
  });
  return adapter;
}

function datePlusdDays(date, number) {
  let mydate = new Date(date.getTime());
  mydate.setDate(mydate.getDate() + number);
  return mydate;
}

function getRiskIndexText(index) {
  let indextext_de = {
    '0': 'keine Belastung',
    '0-1': 'keine bis geringe Belastung',
    '1': 'geringe Belastung',
    '1-2': 'geringe bis mittlere Belastung',
    '2': 'mittlere Belastung',
    '2-3': 'mittlere bis hohe Belastung',
    '3': 'hohe Belastung'
  };
  let indextext_en = {
    '0': 'not any pollen concentration',
    '0-1': 'not any to low pollen concentration',
    '1': 'low pollen concentration',
    '1-2': 'low to medium pollen concentration',
    '2': 'medium pollen concentration',
    '2-3': 'medium to high pollen concentration',
    '3': 'high pollen concentration'
  };
  if (systemLanguage === 'DE') {
    return indextext_de[index] || 'keine Daten vorhanden';
  } else {
    return indextext_en[index] || 'no data available';
  }
}

function getRiskNumber(index) {
  let number;
  switch (index) {
    case '0-1':
      number = 0.5;
      break;
    case '1-2':
      number = 1.5;
      break;
    case '2-3':
      number = 2.5;
      break;
    default:
      number = 1.0 * index;
      break;
  }
  return number;
}

// *****************************************************************************************************
// 21.02.2019 11:00 Uhr -> Date Object
// *****************************************************************************************************
function getDate(datum) {
  let mydate;
  if (datum) {
    let seps = [' ', '\\.', '\\+', '-', '\\(', '\\)', '\\*', '/', ':', '\\?'];
    let fields = datum.split(new RegExp(seps.join('|'), 'g'));
    mydate = new Date(fields[0], fields[1] - 1, fields[2], fields[3], fields[4]);
  }
  return mydate;
}

function getWeekday(datum) {
  let weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednsday', 'Thursday', 'Friday', 'Saturday'];
  let n = weekday[datum.getDay()];
  return n;
}

async function deleteObjects(result) {
  try {
    if (result) {
      let content = getPollenflugForRegion(result, adapter.config.region) || [];
      let devices = await adapter.getDevicesAsync();
      for (let j in devices) {
        let id = devices[j]._id.replace(adapter.namespace + '.', '');
        let found = false;
        for (let i in content) {
          let entry = content[i];
          let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
          let deviceid = 'region#' + partregion_id;
          if (deviceid === id || id === 'info') {
            found = true;
            break;
          }
        }
        if (found === false) {
          await adapter.deleteDeviceAsync(id);
        }
      }
    }
  } catch (error) {
    adapter.log.error('Error deleting Objects');
  }
}

async function createObjects(result) {
  try {
    if (result) {
      let content = getPollenflugForRegion(result, adapter.config.region) || [];
      let promise = [];
      for (let i in content) {
        let entry = content[i];
        let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
        let partregion_name = entry.partregion_id != -1 ? entry.region_name + ' - ' + entry.partregion_name : entry.region_name;
        let deviceid = adapter.namespace + '.region#' + partregion_id;
        await adapter.setObjectNotExistsAsync(deviceid, {
          type: 'device',
          common: {
            name: partregion_name
          }
        });
        for (let j in entry.Pollen) {
          let pollen = entry.Pollen[j];
          let channelid = deviceid + '.' + j;
          await adapter.setObjectNotExistsAsync(channelid, {
            type: 'channel',
            common: {
              name: j
            }
          });
          for (let k in pollen) {
            let riskindex = pollen[k];
            let stateid = channelid + '.index_' + k;
            promise.push(await adapter.setObjectNotExistsAsync(stateid, {
              type: 'state',
              common: {
                name: k,
                type: 'number',
                role: 'state',
              },
              native: {}
            }));
            stateid = channelid + '.text_' + k;
            promise.push(await adapter.setObjectNotExistsAsync(stateid, {
              type: 'state',
              common: {
                name: k,
                type: 'string',
                role: 'state'
              },
              native: {}
            }));
          }
        }
      }
      await Promise.all(promise);
      await adapter.setObjectNotExistsAsync('info', {
        type: 'device',
        common: {
          name: 'Information'
        }
      });
      await adapter.setObjectNotExistsAsync('info.today', {
        type: 'state',
        common: {
          name: 'Today',
          type: 'string',
          role: 'date'
        },
        native: {}
      });
      await adapter.setObjectNotExistsAsync('info.tomorrow', {
        type: 'state',
        common: {
          name: 'Tomorow',
          type: 'string',
          role: 'date'
        },
        native: {}
      });
      await adapter.setObjectNotExistsAsync('info.dayaftertomorrow', {
        type: 'state',
        common: {
          name: 'Day after tomorrow',
          type: 'string',
          role: 'date'
        },
        native: {}
      });
    }
  } catch (error) {
    adapter.log.error('Error creating Objects');
  }
}


async function setStates(result) {
  try {
    if (result) {
      let content = getPollenflugForRegion(result, adapter.config.region) || [];
      let promise = [];
      for (let i in content) {
        let entry = content[i];
        let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
        let deviceid = adapter.namespace + '.region#' + partregion_id;
        for (let j in entry.Pollen) {
          let channelid = deviceid + '.' + j;
          let pollen = entry.Pollen[j];
          for (let k in pollen) {
            let riskindex = pollen[k];
            let stateid = channelid + '.index_' + k;
            promise.push(await adapter.setStateAsync(stateid, { val: getRiskNumber(riskindex), ack: true }));
            stateid = channelid + '.text_' + k;
            promise.push(await adapter.setStateAsync(stateid, { val: getRiskIndexText(riskindex), ack: true }));
          }
        }
      }
      let today = getDate(result.last_update);
      let tomorrow = datePlusdDays(today, 1);
      let dayaftertomorrow = datePlusdDays(today, 2);
      promise.push(await adapter.setStateAsync('info.today', { val: today.toString(), ack: true }));
      promise.push(await adapter.setStateAsync('info.tomorrow', { val: tomorrow.toString(), ack: true }));
      promise.push(await adapter.setStateAsync('info.dayaftertomorrow', { val: dayaftertomorrow.toString(), ack: true }));
      await Promise.all(promise);
    }
  } catch (error) {
    adapter.log.error('Error setting States');
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
  let url = adapter.config.url;
  try {
    adapter.log.info('Requesting DWD pollen information now.');
    result = await request(url, { method: 'GET', json: true, timeout: 5000 });
  } catch (error) {
    adapter.log.error('Error requesting URL ' + url);
  }
  return result;
}

async function polling(result) {
  if (!result) {
    result = await pollenflugRequest();
  }
  let polltime = 10 * 60 * 1000; //10 minutes
  if (result) {
    await setStates(result);
    let now = new Date();
    let next_update = getDate(result.next_update);
    polltime = (next_update.getTime() - now.getTime()) + (1 * 60 * 1000); // + Offset of 1 Minute
    if (polltime < 0 || polltime >= 2147483647) {
      polltime = 5 * 60 * 1000; // 10 minutes
      adapter.log.info('Next DWD pollen request starts in ' + (polltime / (60 * 1000)) + ' minutes.');
    } else {
      adapter.log.info('Next DWD pollen request starts on ' + next_update.toString());
    }
  }
  setTimeout(async () => {
    await polling();
  }, polltime);
}

// *****************************************************************************************************
// Main
// *****************************************************************************************************
async function main() {
  let result = await pollenflugRequest();
  if (result) {
    await deleteObjects(result); // delete old objects
    await createObjects(result); // create object. once at start of adapter
    await polling(result); // periodical polling of states (once the day)
  } else {
    adapter.log.error('Error reading pollen risk index.');
    setTimeout(async () => {
      await main();
    }, 1 * 60 * 1000); // try to get data in 1 Minute
  }
}

// If started as allInOne mode => return function to create instance
if (typeof module !== 'undefined' && module.parent) {
  module.exports = startAdapter;
} else {
  // or start the instance dirbectly
  startAdapter();
}
