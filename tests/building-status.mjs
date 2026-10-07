import assert from 'node:assert/strict';
import {buildingStatus} from '../public/building-status.js';
assert.equal(buildingStatus([0,1,1,1,0],0),'paused');
assert.equal(buildingStatus([0,1,0,1,0],0),'inputs');
assert.equal(buildingStatus([0,1,0,3,0],0),'workers');
assert.equal(buildingStatus([0,1,0,1,0],3),'inputs');
assert.equal(buildingStatus([0,1,0,0,2],3),null);
assert.equal(buildingStatus([0,0,0,0,0],5),null);
console.log('Building status: paused/worker/input priority and productive low-efficiency buildings pass.');

assert.equal(buildingStatus([0,2,0,0,0],0),null);
assert.equal(buildingStatus([0,3,0,3,0],0),'workers');

assert.equal(buildingStatus([1,15,0,2],0),'paused');
