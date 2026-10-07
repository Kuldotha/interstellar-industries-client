export function attachEditorCamera(camera,canvas){
 camera.attachControl(canvas,true);
 camera.inputs.attached.pointers.buttons=[1,2];
 camera.movement.input.inputMap=camera.movement.input.inputMap.filter(entry=>entry.source!=='pointer');
 camera.movement.input.addEntry({source:'pointer',button:2,interaction:'rotate'});
 const referenceDistance=6,referenceSensitivity=960;
 camera.movement.input.addEntry({source:'pointer',button:1,interaction:'pan',get sensitivity(){return camera.radius/(referenceDistance*referenceSensitivity);}});
}
