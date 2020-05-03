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

/**
 * Change the external Sentry Logging. After changing the Logging
 * the adapter restarts once
 * @param {*} id : adapter.config.sentry_enable for example
 */
async function setSentryLogging(value) {
  try {
    value = value === true;
    let idSentry = 'system.adapter.' + adapter.namespace + '.plugins.sentry.enabled';
    let stateSentry = await adapter.getForeignStateAsync(idSentry);
    if (stateSentry && stateSentry.val !== value) {
      await adapter.setForeignStateAsync(idSentry, value);
      adapter.log.info('Restarting Adapter because of changeing Sentry settings');
      adapter.restart();
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

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
    if (await setSentryLogging(adapter.config.sentry_enable)) return;
    if (!semver.satisfies(process.version, adapterNodeVer)) {
      adapter.log.error(`Required node version ${adapterNodeVer} not satisfied with current version ${process.version}.`);
      setTimeout(() => adapter.stop());
    }
    let obj = await adapter.getForeignObjectAsync('system.config');
    if (obj && obj.common && obj.common.language) systemLanguage = (obj.common.language).toUpperCase();
    await main();
  });
  return adapter;
}

function datePlusdDays(date, number) {
  let mydate = new Date(date.getTime());
  mydate.setDate(mydate.getDate() + number);
  return mydate;
}

function getImage(weekday, plant) {
  let url = 'https://www.dwd.de/DWD/warnungen/medizin/pollen/';
  if (weekday && plant) {
    let plants = {
      hasel: 0,
      erle: 1,
      birke: 2,
      graeser: 3,
      roggen: 4,
      beifuss: 5,
      ambrosia: 6,
      esche: 7,
    };
    let weekdays = {
      today: 1,
      tomorrow: 2,
      dayaftertomorrow: 3
    };

    let urlweekday = weekdays[weekday.toLowerCase()];
    let urlplant = plants[plant.toLowerCase()];
    return url + 'pollen_' + urlweekday + '_' + urlplant + '.png';
  } else {
    return '';
  }
}

function getRiskIndexText(index, plant) {
  let text;
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
    text = indextext_de[index] || 'keine Daten vorhanden';
    if (plant) {
      text = text + ' für ' + plant;
    }
  } else {
    text = indextext_en[index] || 'no data available';
    if (plant) {
      text = text + ' for ' + plant;
    }
  }
  return text;
}

function getRiskNumber(index) {
  let number;
  switch (index) {
    case '0':
      number = 0;
      break;
    case '0-1':
      number = 1;
      break;
    case '1':
      number = 2;
      break;
    case '1-2':
      number = 3;
      break;
    case '2':
      number = 4;
      break;
    case '2-3':
      number = 5;
      break;
    case '3':
      number = 6;
      break;
    default:
      number = -1;
      break;
  }
  return number;
}

async function deleteOldState(deviceid) {
  try {
    if (deviceid) {
      let states = await adapter.getStatesOfAsync(deviceid, deviceid);
      for (let j in states) {
        let stateid = states[j]._id.split('.').pop();
        if (stateid.endsWith('_dayaftertomorrow') || stateid.endsWith('_dayafter_to') || stateid.startsWith('json_text_')) {
          let id = states[j]._id.replace(adapter.config.namespace + '.', '');
          await adapter.delObjectAsync(id);
        }
      }
    }
  } catch (error) {
    adapter.log.error('Error deleting old States: ' + deviceid + ' / ' + error);
  }
}

async function deleteDeviceRecursiveAsync(deviceid) {
  try {
    if (deviceid) {
      let channels = await adapter.getChannelsOfAsync(deviceid);
      for (let i in channels) {
        let channelid = channels[i]._id.split('.').pop();
        let states = await adapter.getStatesOfAsync(deviceid, channelid);
        for (let j in states) {
          let stateid = states[j]._id.split('.').pop();
          let id = deviceid + '.' + channelid + '.' + stateid;
          await adapter.delObjectAsync(id);
        }
        await adapter.deleteChannelAsync(deviceid, channelid);
      }
      let states = await adapter.getStatesOfAsync(deviceid, deviceid);
      for (let j in states) {
        let stateid = states[j]._id.split('.').pop();
        let id = deviceid + '.' + stateid;
        await adapter.delObjectAsync(id);
      }
      await adapter.deleteDeviceAsync(deviceid);
    }
  } catch (error) {
    adapter.log.error('Error deleting Device: ' + deviceid + ' / ' + error);
  }
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
      let promise = [];
      for (let j in devices) {
        // let id = devices[j]._id.replace(adapter.namespace + '.', '');
        let id = devices[j]._id.split('.').pop();
        await deleteOldState(id);
        let found = false;
        for (let i in content) {
          let entry = content[i];
          let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
          let deviceid = 'region#' + partregion_id;
          if (deviceid === id || id === 'info' || id === 'images') {
            found = true;
            break;
          }
        }
        if (found === false && id) {
          // await adapter.deleteDeviceAsync(id);
          promise.push(await deleteDeviceRecursiveAsync(id));
        }
      }
      await Promise.all(promise);
    }
  } catch (error) {
    adapter.log.error('Error deleting Objects ' + error);
  }
}

async function createInfoObjects() {
  try {
    let promise = [];
    await adapter.setObjectNotExistsAsync('info', {
      type: 'device',
      common: {
        name: 'Information'
      }
    });
    promise.push(await adapter.setObjectNotExistsAsync('info.today', {
      type: 'state',
      common: {
        name: 'Today',
        type: 'string',
        role: 'date',
        read: true,
        write: false
      },
      native: {}
    }));
    promise.push(await adapter.setObjectNotExistsAsync('info.tomorrow', {
      type: 'state',
      common: {
        name: 'Tomorow',
        type: 'string',
        role: 'date',
        read: true,
        write: false
      },
      native: {}
    }));
    /*
    promise.push(await adapter.setObjectNotExistsAsync('info.dayaftertomorrow', {
      type: 'state',
      common: {
        name: 'Day after tomorrow',
        type: 'string',
        role: 'date',
        read: true,
        write: false
      },
      native: {}
    }));
    */
    await Promise.all(promise);
  } catch (error) {
    adapter.log.error('Error creating Info Objects ' + error);
  }
}


async function createImageObjects(result) {
  try {
    if (result) {
      let content = getPollenflugForRegion(result, adapter.config.region) || [];
      let promise = [];
      let deviceid = adapter.namespace + '.images';
      await adapter.setObjectNotExistsAsync(deviceid, {
        type: 'device',
        common: {
          name: 'Images'
        }
      });
      for (let i in content) {
        let entry = content[i];
        for (let j in entry.Pollen) {
          let pollen = entry.Pollen[j];
          let channelid = deviceid + '.' + j;
          await adapter.setObjectNotExistsAsync(channelid, {
            type: 'channel',
            common: {
              name: 'Images for ' + j
            }
          });
          promise.push(await adapter.setObjectNotExistsAsync(channelid + '.image_today', {
            type: 'state',
            common: {
              name: 'Today',
              type: 'string',
              role: 'weather.chart.url',
              read: true,
              write: false
            },
            native: {}
          }));
          promise.push(await adapter.setObjectNotExistsAsync(channelid + '.image_tomorrow', {
            type: 'state',
            common: {
              name: 'Tomorow',
              type: 'string',
              role: 'weather.chart.url',
              read: true,
              write: false
            },
            native: {}
          }));
          /*
          promise.push(await adapter.setObjectNotExistsAsync(channelid + '.image_dayaftertomorrow', {
            type: 'state',
            common: {
              name: 'Day after tomorrow',
              type: 'string',
              role: 'weather.chart.url',
              read: true,
              write: false
            },
            native: {}
          }));
          */
        }
        break; // only one call
      }
      await Promise.all(promise);
    }
  } catch (error) {
    adapter.log.error('Error creating Objects ' + error);
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
        let channelid = deviceid + '.summary';
        await adapter.setObjectNotExistsAsync(channelid, {
          type: 'channel',
          common: {
            name: 'summary'
          }
        });
        // let days = ['today', 'tomorrow', 'dayafter_to'];
        let days = ['today', 'tomorrow'];
        for (let m in days) {
          let day = days[m];
          let stateid = deviceid + '.summary.json_index_' + day;
          promise.push(await adapter.setObjectNotExistsAsync(stateid, {
            type: 'state',
            common: {
              name: 'Summary ' + day + ' (index)',
              type: 'string',
              role: 'state',
              read: true,
              write: false
            },
            native: {}
          }));
          /*
          stateid = deviceid + '.summary.json_text_' + day;
          promise.push(await adapter.setObjectNotExistsAsync(stateid, {
            type: 'state',
            common: {
              name: 'Summary ' + day + ' (text)',
              type: 'string',
              role: 'state',
              read: true,
              write: false
            },
            native: {}
          }));
          */
          stateid = deviceid + '.summary.json_riskindex_' + day;
          promise.push(await adapter.setObjectNotExistsAsync(stateid, {
            type: 'state',
            common: {
              name: 'Summary ' + day + ' (riskindex)',
              type: 'string',
              role: 'state',
              read: true,
              write: false
            },
            native: {}
          }));
          let channelid = deviceid + '.riskindex_' + days[m];
          await adapter.setObjectNotExistsAsync(channelid, {
            type: 'channel',
            common: {
              name: 'riskindex'
            }
          });
          for (let l = 0; l <= 6; l++) {
            let stateid = channelid + '.riskindex_' + l;
            promise.push(await adapter.setObjectNotExistsAsync(stateid, {
              type: 'state',
              common: {
                name: 'Riskindex ' + l,
                type: 'string',
                role: 'state',
                read: true,
                write: false
              },
              native: {}
            }));
          }
        }
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
            if (k === 'dayafter_to') continue;
            let riskindex = pollen[k];
            let stateid = channelid + '.index_' + k;
            promise.push(await adapter.setObjectNotExistsAsync(stateid, {
              type: 'state',
              common: {
                name: k,
                type: 'number',
                role: 'state',
                read: true,
                write: false
              },
              native: {}
            }));
            stateid = channelid + '.text_' + k;
            promise.push(await adapter.setObjectNotExistsAsync(stateid, {
              type: 'state',
              common: {
                name: k,
                type: 'string',
                role: 'state',
                read: true,
                write: false
              },
              native: {}
            }));
          }
        }
      }
      await Promise.all(promise);
    }
  } catch (error) {
    adapter.log.error('Error creating Objects ' + error);
  }
}


async function setStates(result) {
  try {
    if (result) {
      let content = getPollenflugForRegion(result, adapter.config.region) || [];
      let promise = [];
      let image = false;
      for (let i in content) {
        let entry = content[i];
        let partregion_id = entry.partregion_id != -1 ? entry.partregion_id : entry.region_id;
        let deviceid = adapter.namespace + '.region#' + partregion_id;
        let json_index = {};
        // let json_text = {};
        let json_riskindex = {};
        let index = {};
        for (let j in entry.Pollen) {
          let channelid = deviceid + '.' + j;
          let pollen = entry.Pollen[j];
          for (let k in pollen) {
            if (k === 'dayafter_to') continue;
            let riskindex = pollen[k];
            if (!json_index[k]) { json_index[k] = []; }
            // if (!json_text[k]) { json_text[k] = []; }
            if (!index[k]) { index[k] = {}; }
            if (!index[k][getRiskNumber(riskindex)]) {
              index[k][getRiskNumber(riskindex)] = [j];
            } else {
              index[k][getRiskNumber(riskindex)].push(j);
            }
            if (getRiskNumber(riskindex) >= 0) {
              json_index[k].push({
                'Pollen': j,
                'Riskindex': getRiskNumber(riskindex),
                'Riskindextext': getRiskIndexText(riskindex)
              });
              /*
              json_text[k].push({ 
                'Pollen': j, 
                'Riskindextext':  getRiskIndexText(riskindex),
                'Riskindex': getRiskNumber(riskindex)
              });
              */
              // json_index[k][j] = getRiskNumber(riskindex);
              //json_text[k][j] = getRiskIndexText(riskindex, j);
            }
            let stateid = channelid + '.index_' + k;
            promise.push(await adapter.setStateAsync(stateid, { val: getRiskNumber(riskindex), ack: true }));
            stateid = channelid + '.text_' + k;
            promise.push(await adapter.setStateAsync(stateid, { val: getRiskIndexText(riskindex, j), ack: true }));
          }
          if (image === false) {
            let imageid = adapter.namespace + '.images.' + j;
            promise.push(await adapter.setStateAsync(imageid + '.image_today', { val: getImage('today', j), ack: true }));
            promise.push(await adapter.setStateAsync(imageid + '.image_tomorrow', { val: getImage('tomorrow', j), ack: true }));
            // promise.push(await adapter.setStateAsync(imageid + '.image_dayaftertomorrow', { val: getImage('dayaftertomorrow', j), ack: true }));
          }
        }
        image = true;

        // let days = ['today', 'tomorrow', 'dayafter_to'];
        let days = ['today', 'tomorrow'];
        for (let m in days) {
          let day = days[m];
          let stateid = deviceid + '.summary.json_index_' + day;
          promise.push(await adapter.setStateAsync(stateid, { val: JSON.stringify(json_index[day] || {}), ack: true }));
          // stateid = deviceid + '.summary.json_text_' + day;
          // promise.push(await adapter.setStateAsync(stateid, { val: JSON.stringify(json_text[day] || {}), ack: true }));

          let riskindex = {};
          riskindex[day] = [];
          for (let n = 0; n <= 6; n++) {
            riskindex[day].push({
              'Riskindex': n,
              'Riskindextext': getRiskIndexText(n),
              'Pollen': index[day][n] ? (index[day][n]).toString().replace(/,/g, ', ') : ''
            });
          }
          stateid = deviceid + '.summary.json_riskindex_' + day;
          promise.push(await adapter.setStateAsync(stateid, { val: JSON.stringify(riskindex[day] || {}), ack: true }));
          for (let l = 0; l <= 6; l++) {
            let value = index && index[day] && index[day][l] ? index[day][l].toString().replace(/,/g, ', ') : '';
            let stateid = deviceid + '.riskindex_' + day + '.riskindex_' + l;
            promise.push(await adapter.setStateAsync(stateid, { val: value, ack: true }));
          }
        }
      }

      let today = getDate(result.last_update);
      let tomorrow = datePlusdDays(today, 1);
      // let dayaftertomorrow = datePlusdDays(today, 2);
      promise.push(await adapter.setStateAsync('info.today', { val: today.toString(), ack: true }));
      promise.push(await adapter.setStateAsync('info.tomorrow', { val: tomorrow.toString(), ack: true }));
      // promise.push(await adapter.setStateAsync('info.dayaftertomorrow', { val: dayaftertomorrow.toString(), ack: true }));
      await Promise.all(promise);
    }
  } catch (error) {
    adapter.log.error('Error setting States ' + error);
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
  let url = adapter.config.url || 'https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json';
  try {
    adapter.log.info('Requesting DWD pollen information now.');
    result = await request(url, { method: 'GET', json: true, rejectUnauthorized: false, timeout: 5000 });
  } catch (error) {
    adapter.log.error('Error requesting URL ' + url + ' (' + error + ')');
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
    await createInfoObjects();
    await createObjects(result); // create object. once at start of adapter
    await createImageObjects(result);
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
