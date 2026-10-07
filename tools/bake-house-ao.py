import bpy, sys, os, json, hashlib
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
source=os.path.join(root,'models/house_01.glb')
out=os.path.join(root,'models/baked')
os.makedirs(out,exist_ok=True)
previous_materials=set(bpy.data.materials)
previous_images=set(bpy.data.images)
previous_editors=[(space,space.image) for screen in bpy.data.screens for area in screen.areas for space in area.spaces if space.type=='IMAGE_EDITOR']
previous_scene=bpy.context.window.scene
temporary_scene=bpy.data.scenes.new('AO bake workspace')
bpy.context.window.scene=temporary_scene
try:
    bpy.ops.import_scene.gltf(filepath=source)
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('house_01'))
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    mesh=obj.data
    mesh.uv_layers.new(name='AmbientOcclusion');mesh.uv_layers.active_index=1
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.151917,island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    image=bpy.data.images.new('House AO',width=512,height=512,alpha=False)
    image.colorspace_settings.name='Non-Color';image.generated_color=(1,1,1,1)
    materials=list(mesh.materials)
    for i,original in enumerate(materials):
        mat=bpy.data.materials.new('Bake '+original.name);mat.use_nodes=True
        nodes=mat.node_tree.nodes;nodes.clear()
        ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=.45;ao.only_local=True
        emission=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial');target=nodes.new('ShaderNodeTexImage');target.image=image;nodes.active=target
        mat.node_tree.links.new(ao.outputs['Color'],emission.inputs['Color']);mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface']);mesh.materials[i]=mat
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=64
    scene.render.bake.margin=8;scene.render.bake.use_clear=False
    bpy.ops.object.bake(type='EMIT')
    image.filepath_raw=os.path.join(out,'house_01-ao.png');image.file_format='PNG';image.save()
    mesh.calc_loop_triangles()
    parts=[]
    for material_index,material in enumerate(materials):
        part={'material':'Shades' if material.name.startswith('Shades') else 'Atlas','positions':[],'normals':[],'uvs':[],'uvs2':[],'indices':[]}
        for tri in mesh.loop_triangles:
            if tri.material_index!=material_index:continue
            for loop_index in reversed(tri.loops):
                loop=mesh.loops[loop_index];v=mesh.vertices[loop.vertex_index].co;n=mesh.corner_normals[loop_index].vector
                part['positions'].extend([v.x,v.z,v.y]);part['normals'].extend([n.x,n.z,n.y])
                for key,layer in [('uvs',mesh.uv_layers[0]),('uvs2',mesh.uv_layers[1])]:
                    uv=layer.data[loop_index].uv;part[key].extend([uv.x,1-uv.y])
                part['indices'].append(len(part['indices']))
        parts.append(part)
    with open(os.path.join(out,'house_01.json'),'w') as f:json.dump({'parts':parts,'sourceSha256':hashlib.sha256(open(source,'rb').read()).hexdigest()},f,separators=(',',':'))
    print('AO_BAKE_COMPLETE',sum(len(p['indices'])//3 for p in parts))
    
finally:
    bpy.context.window.scene=previous_scene
    for item in list(temporary_scene.objects):
        mesh_data=item.data if item.type=='MESH' else None
        bpy.data.objects.remove(item,do_unlink=True)
        if mesh_data and mesh_data.users==0:bpy.data.meshes.remove(mesh_data)
    bpy.data.scenes.remove(temporary_scene)
    for space,image in previous_editors:space.image=image
    for material in set(bpy.data.materials)-previous_materials:
        if not material.users:bpy.data.materials.remove(material)
    for image in set(bpy.data.images)-previous_images:
        if not image.users:bpy.data.images.remove(image)
