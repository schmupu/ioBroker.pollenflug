![Logo](admin/pollenflug.png)

# Pollen risk index
[![Travis CI Build Status](https://travis-ci.org/schmupu/ioBroker.pollenflug.svg?branch=master)](https://travis-ci.org/schmupu/ioBroker.pollenflug)
[![AppVeyor Build Status](https://ci.appveyor.com/api/projects/status/github/schmupu/ioBroker.pollenflug?branch=master&svg=true)](https://ci.appveyor.com/project/schmupu/ioBroker-pollenflug/)
[![NPM version](http://img.shields.io/npm/v/iobroker.pollenflug.svg)](https://www.npmjs.com/package/iobroker.pollenflug)
[![Downloads](https://img.shields.io/npm/dm/iobroker.pollenflug.svg)](https://www.npmjs.com/package/iobroker.pollenflug)

[![NPM](https://nodei.co/npm/iobroker.pollenflug.png?downloads=true)](https://nodei.co/npm/iobroker.pollenflug/)


![DWDLogo](admin/dwdlogo.png)

The German Weather Service DWD prepares daily forecasts of the pollen risk index.
The pollen species are predicted: hazel, alder, ash, birch, grass, rye, mugwort and
ambrosia for today and tomorrow, on Friday also for the day after tomorrow (Sunday).
Updated daily in the morning.
Information on the pollen counties can be found at: https://www.dwd.de/pollenflug
Copyright of used pollen data: © Deutscher Wetterdienst (Quelle: Deutscher Wetterdienst)

## Install & Configuration
Requires node.js 8.0 or higher and Admin v3! Select the county in the ioBroker adapter
configuration. You will get the pollen risk index for this county. The index will be updated 
once the day, around 11 o'clock.
In the objects info.today, info.tomorrow and info.dayaftertomorrow the validity period will be shown.
It can possible that for example today is friday but in the object info.today the day ist thursday. 
That is correct, because the DWD data are still from thursday and not updated till now. The update will be
at 11 o'clock normaly.  

Provided German counties:
* Schleswig-Holstein und Hamburg (region 11 and 12)
* Mecklenburg-Vorpommern  (region 20)
* Niedersachsen und Bremen  (region 31 and 32)
* Nordrhein-Westfalen (region 41, 42 and 43)
* Brandenburg und Berlin (region 50)
* Sachsen-Anhalt  (region 61 and 62)
* Thüringen (region 71 and 72)
* Sachsen  (region 81 and 82)
* Hessen  (region 91 and 92)
* Rheinland-Pfalz und Saarland  (region 101, 102 and 103)
* Baden-Württemberg  (region 111, 112 and 113)
* Bayern (region 121, 122, 123 and 124)

![ioBroker1](docs/iobroker-pollenflug1.png)

The original DWD risk index 0-1, 1-2 and 2-3 are changed to 0.5, 1.5 and 2.5. 
This format can more simply used in ioBroker.  

| Index | description                       	|
|-----	|------------------------------------ |
| -1   	| no data available                   |
| 0   	| low pollen concentration         	  |
| 0.5 	| low to medium pollen concentration  |
| 1   	| low pollen concentration        	  |
| 1.5 	| low to medium pollen concentration	|
| 2   	| average pollen concentration      	|
| 2.5 	| medium to high pollen concentration |
| 3   	| high pollen concentration          	|

![ioBroker2](docs/iobroker-pollenflug2.png)


## Changelog

### 0.1.5 (23.11.2018)
* (Stübi) First Version of pollen index adapter


## License
The MIT License (MIT)

Copyright (c) 2019 Thorsten <thorsten@stueben.de> / <https://github.com/schmupu>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
