export const buildingDefinitions=[
  {
    "name": "Granule Quarry",
    "urban": false,
    "output": "granules",
    "icon": "granules.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Concrete Factory",
    "urban": false,
    "output": "concrete",
    "input": "granules",
    "icon": "concrete.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Housing",
    "urban": true,
    "output": "housing",
    "icon": "housing.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Fishing Docks",
    "urban": false,
    "output": "fish",
    "icon": "fish.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Commons",
    "urban": true,
    "output": "commons",
    "icon": "commons.svg",
    "utility": true,
    "power": 0
  },
  {
    "name": "Fiber Farm",
    "urban": false,
    "output": "fibers",
    "icon": "fibers.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Weaving Mill",
    "urban": false,
    "output": "clothes",
    "input": "fibers",
    "icon": "clothes.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Tuber Farm",
    "urban": false,
    "output": "tubers",
    "icon": "tubers.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Brewery",
    "urban": false,
    "output": "beer",
    "input": "tubers",
    "icon": "beer.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Biomass Farm",
    "urban": false,
    "output": "biomass",
    "icon": "biomass.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Biomass Power Station",
    "urban": false,
    "output": "power",
    "input": "biomass",
    "icon": "power.svg",
    "utility": false,
    "power": 0
  },
  {
    "name": "Radio Station",
    "urban": true,
    "output": "radio",
    "icon": "radio.svg",
    "utility": true,
    "power": 1
  }
,
{name:'Fiber Field',urban:false,output:'fibers',icon:'fibers.svg',farm:5},
{name:'Tuber Field',urban:false,output:'tubers',icon:'tubers.svg',farm:7},
{name:'Biomass Field',urban:false,output:'biomass',icon:'biomass.svg',farm:9},
{name:'Generator Module',urban:false,output:'power',input:'biomass',icon:'power.svg',parent:10}
];
for(const [farm,field] of [[5,12],[7,13],[9,14]])buildingDefinitions[farm].field=field;
buildingDefinitions[10].module=15;
for(const kind of [0,1,3,6,8])buildingDefinitions[kind].powerBoost=true;
export const resourceNames=["Granules","Concrete","Fish","Rough fibers","Worker clothes","Tubers","Beer","Biomass"];

const buildingIcons=['quarry','concrete-factory','housing','fishing-docks','commons','fiber-farm','weaving-mill','tuber-farm','brewery','biomass-farm','biomass-generator','radio','fiber-field','tuber-field','biomass-field','biomass-generator'];
for(const [kind,building] of buildingDefinitions.entries())building.buildingIcon=buildingIcons[kind]+'.svg';
