use std::cell::RefCell;
use production_runtime::{Engine,Q,population::{PopulationTier,workforce_capacity,project_stock}};
use production_runtime::{colony_buildings as buildings,colony_needs::{self,ColonyNeeds}};
const RECIPES:[usize;8]=buildings::RECIPES;
const RESOURCES:[usize;8]=buildings::RESOURCE_IDS;
const STORAGE:u64=100*Q;
const CYCLE_WORK:u32=300;
const HOUSE:u32=2;
const DOCK:u32=3;
const COMMONS:u32=4;
pub const STRIDE:usize=11;
type Building=[u32;STRIDE];

#[derive(Clone,Default)]
pub struct Industry {pub pool:[u32;8],pub buildings:Vec<Building>,pub tick:u32,pub tutorial:u32,peak_population:u32,produced:[u32;8],restoring:bool,neighbors:Vec<u32>,tier:PopulationTier,needs:ColonyNeeds,metadata_dirty:bool,metadata_updates:u32,paid_costs:std::collections::BTreeMap<u32,u32>,engine:Engine,inventory:[u64;8],mirror:[u32;8],rate:[i64;8],carry:[i64;8],made:[u64;8],key:Vec<u64>,solves:u32,fish_fulfillment:u32,power_supply:u64,power_required:u64,power_factory:u64,power_demand:u64}
impl Industry {
    fn cost(kind:u32)->u32 {buildings::cost(kind as u8) as u32}
    pub fn starter()->Self {Self{pool:[0,2,0,0,0,0,0,0],..Self::default()}}
    pub fn population(&self)->u32 {self.tier.population as u32}
    fn needs_workers(b:&Building)->bool {b[2]==0 && Self::worker_cost(b[1])>0}
    fn worker_cost(kind:u32)->u32 {buildings::workers(kind as u8) as u32}
    pub fn workers(&self)->u32 {self.buildings.iter().filter(|b|Self::needs_workers(b)).map(|b|Self::worker_cost(b[1])).sum()}
    pub fn valid_sides(tile:u32,kind:u32,surfaces:&[u32],neighbors:&[u32])->u32 {
        if tile as usize>=surfaces.len(){return 0;}
        let mut mask=0;
        for side in 0..6 {
            let neighbor=neighbors[tile as usize*6+side] as usize;
            if neighbor<surfaces.len() && (kind!=DOCK || surfaces[neighbor]==0){mask|=1<<side;}
        }
        mask
    }
    fn parent(&self,b:&Building)->Option<u32>{if buildings::farm_kind(b[1] as u8).is_none(){return None;}self.neighbors.get(b[0] as usize*6+b[6] as usize).copied()}
    fn fields(&self,tile:u32)->u64{self.buildings.iter().filter(|b|self.parent(b)==Some(tile)).count() as u64}
    fn placement_sides(&self,tile:u32,kind:u32,surfaces:&[u32],neighbors:&[u32])->u32{
        let Some(farm)=buildings::farm_kind(kind as u8)else{return Self::valid_sides(tile,kind,surfaces,neighbors);};
        let mut mask=0;for side in 0..6{if let Some(&n)=neighbors.get(tile as usize*6+side){if self.buildings.iter().any(|b|b[0]==n&&b[1]==farm as u32)&&self.fields(n)<3{mask|=1<<side;}}}mask
    }
    pub fn validate(&self,tile:u32,kind:u32,surfaces:&[u32],features:&[u32],neighbors:&[u32])->u32 {
        if kind>=buildings::BUILDING_COUNT as u32 || tile as usize>=surfaces.len(){return 1;}
        if self.buildings.iter().any(|b|b[0]==tile){return 2;}
        if surfaces[tile as usize]==0{return 3;}
        if kind==0 && features[tile as usize]&2==0{return 4;}
        if kind==DOCK && Self::valid_sides(tile,kind,surfaces,neighbors)==0{return 6;}
        if buildings::farm_kind(kind as u8).is_some()&&self.placement_sides(tile,kind,surfaces,neighbors)==0{return 10;}
        if self.pool[1]<Self::cost(kind){return 5;}
        0
    }
    pub fn build(&mut self,tile:u32,kind:u32,side:u32,surfaces:&[u32],features:&[u32],neighbors:&[u32])->u32 {
        let error=self.validate(tile,kind,surfaces,features,neighbors);if error!=0{return error;}
        if side>=6 || self.placement_sides(tile,kind,surfaces,neighbors)&(1<<side)==0{return 7;}
        self.neighbors=neighbors.to_vec();
        self.pool[1]-=Self::cost(kind);
        self.paid_costs.insert(tile,Self::cost(kind));
        self.buildings.push([tile,kind,0,0,0,0,side,if kind==HOUSE{2}else{0},0,0,0]);
        self.metadata_dirty=true;self.refresh();0
    }
    pub fn allocation(&self)->Vec<u32> {
        let demand=self.workers().max(1) as u64;
        self.buildings.iter().map(|b|if Self::needs_workers(b){(self.population() as u64*Self::worker_cost(b[1]) as u64/demand).min(Self::worker_cost(b[1]) as u64) as u32}else{0}).collect()
    }
    fn sync_inventory(&mut self){
        for r in 0..8{let difference=self.pool[r] as i64-self.mirror[r] as i64;self.inventory[r]=(self.inventory[r] as i128+difference as i128*Q as i128).max(0).min(production_runtime::MAX as i128) as u64;self.mirror[r]=self.pool[r];}
    }
    fn display_inventory(&mut self){for r in 0..8{self.pool[r]=(self.inventory[r]/Q) as u32;self.mirror[r]=self.pool[r];}}
    fn solve_rates(&mut self){
        let mut capacity=[0;84];for b in &self.buildings{if b[2]==0{if let Some(r)=buildings::resource(b[1] as u8){capacity[RECIPES[r]]+=if buildings::field_kind(b[1] as u8).is_some(){self.fields(b[0])*Q/3}else{Q};}}}
        let mut key=capacity.to_vec();key.push(self.population() as u64);key.push(self.workers() as u64);key.push(self.needs.generators);key.push(self.needs.power_demand);for r in 0..8{key.push(u64::from(self.inventory[r]>0));key.push(u64::from(self.inventory[r]>=STORAGE));}
        if key==self.key{return;}
        let mut inventory=[0;80];let mut limits=[0;80];
        for r in 0..8{inventory[RESOURCES[r]]=self.inventory[r];limits[RESOURCES[r]]=STORAGE+1;}
        let power=production_runtime::colony_power::plan(capacity,self.population() as u64,self.workers() as u64,self.needs.generators,self.needs.power_demand,self.inventory[7]);
        self.power_supply=power.supply;self.power_required=power.required_fraction;self.power_factory=power.factory_fraction;self.power_demand=power.demand;
        capacity=power.capacities;
        let mut demand=colony_needs::demands(self.population() as u64,self.workers() as u64,self.needs.generators,self.needs.power_demand);
        demand[6]=power.fuel;
        self.engine.calculate(capacity,inventory,limits,workforce_capacity(capacity.iter().sum(),self.population() as u64,self.workers() as u64),demand).expect("valid colony production state");
        for r in 0..8{self.rate[r]=self.engine.balance(RESOURCES[r]);}
        self.needs.clothes=self.engine.fulfillment(79);self.needs.beer=self.engine.fulfillment(5);self.tier.food=self.engine.food_fulfillment();self.fish_fulfillment=(self.tier.food*60/Q) as u32;
        self.key=key;self.solves+=1;
    }
    fn power(&self)->u64 {self.power_supply}
    fn power_fulfillment(&self)->u64 {self.power_required}
    fn productivity(&self,kind:u32)->u32 {
        if buildings::power_demand(kind as u8)>0{return (self.power_fulfillment()*100/Q) as u32;}
        if kind==10{return if self.needs.generators==0{0}else{(self.power()*100/(self.needs.generators*10*Q)) as u32};}
        let Some(r)=buildings::resource(kind as u8)else{return 0;};let count=self.buildings.iter().filter(|b|b[1]==kind&&b[2]==0).count() as u64;
        if count==0{0}else{(self.engine.rate(RECIPES[r])*100/(count*Q)) as u32}
    }
    fn utility_reaches(&self,source:u32,tile:u32)->bool {
        if source==tile{return true;}
        let adjacent=|id:u32|if (id as usize)<self.neighbors.len()/6{&self.neighbors[id as usize*6..id as usize*6+6]}else{&[]};
        adjacent(source).iter().any(|&n|n==tile||adjacent(n).contains(&tile))
    }
    fn is_covered_by(&self,tile:u32,kind:u32)->bool {self.buildings.iter().any(|b|b[1]==kind&&b[2]==0&&self.utility_reaches(b[0],tile))}
    fn is_covered(&self,tile:u32)->bool{self.is_covered_by(tile,COMMONS)}
    fn update_metadata(&mut self){
        if !self.metadata_dirty{return;}
        let houses=self.buildings.iter().filter(|b|b[1]==HOUSE).count() as u64;
        if houses>self.tier.houses{self.tier.population+=2*(houses-self.tier.houses);}
        else if houses<self.tier.houses{self.tier.population=self.tier.population*houses/self.tier.houses;}
        self.tier.houses=houses;
        self.tier.commons_covered=self.buildings.iter().filter(|b|b[1]==HOUSE&&self.is_covered(b[0])).count() as u64;
        self.needs.radio_covered=self.buildings.iter().filter(|b|b[1]==HOUSE&&self.is_covered_by(b[0],11)).count() as u64;
        self.needs.generators=self.buildings.iter().filter(|b|b[1]==10&&b[2]==0).count() as u64;
        self.needs.power_demand=self.buildings.iter().filter(|b|b[2]==0).map(|b|buildings::power_demand(b[1] as u8)).sum();
        if houses==0{self.tier=PopulationTier::default();}
        self.metadata_dirty=false;self.metadata_updates+=1;
    }
    fn residents(&self,tile:u32)->u32 {let cap=self.capacity(tile) as u64;(self.tier.population*cap/self.tier.capacity_with(self.needs.clothes).max(1)).min(cap) as u32}
    pub fn refresh(&mut self) {
        self.sync_inventory();self.update_metadata();self.update_progression();self.sync_inventory();
        if self.restoring{return;}
        self.solve_rates();self.update_progression();self.sync_inventory();self.solve_rates();
        let workers=self.workers();let population=self.population();
        let status:Vec<_>=self.buildings.iter().map(|b|if b[2]==1{2}else if b[1]==10&&self.power_demand==0{6}else if buildings::power_demand(b[1] as u8)>0&&self.power_fulfillment()==0{5}else if Self::worker_cost(b[1])==0{0}else if workers>0&&population==0{3}else if self.productivity(b[1])==0{if buildings::resource(b[1] as u8).map(|r|self.inventory[r]>=STORAGE).unwrap_or(false){4}else{1}}else{0}).collect();
        for (b,status) in self.buildings.iter_mut().zip(status){b[5]=0;b[3]=status;}
    }
    fn unlock_population(kind:u32)->u32 {buildings::unlock_population(kind as u8) as u32}
    fn update_progression(&mut self){
        if self.restoring{return;}
        self.peak_population=self.peak_population.max(self.population());
        loop {
            let houses:Vec<_>=self.buildings.iter().filter(|b|b[1]==HOUSE).collect();
            let capacity=|kind:u32|self.buildings.iter().filter(|b|b[1]==kind&&b[2]==0).map(|b|self.fields(b[0])*Q/3).sum();
            let p=production_runtime::colony_progression::Progress{houses:houses.len() as u64,population:self.population() as u64,fish:self.tier.food,quarries:self.buildings.iter().filter(|b|b[1]==0).count() as u64,concrete:self.buildings.iter().filter(|b|b[1]==1).count() as u64,commons:self.tier.commons_covered,fibers:capacity(5),tubers:capacity(7),clothes:self.needs.clothes,beer:self.needs.beer,biomass:capacity(9),generators:self.needs.generators,radio:if self.power_required==Q{self.needs.radio_covered}else{0},ready:houses.iter().any(|b|self.residents(b[0])>=15&&self.fulfillment(b[0]).iter().all(|&f|f==60))};
            if !production_runtime::colony_progression::complete(self.tutorial as u64,&p){break;}
            let reward=production_runtime::colony_progression::reward(self.tutorial as u64) as u32;
            self.pool[1]=self.pool[1].saturating_add(reward);self.tutorial+=1;
        }
    }
    fn fulfillment(&self,tile:u32)->[u32;5] {[if self.is_covered(tile){60}else{0},(self.tier.food*60/Q) as u32,(self.needs.clothes*60/Q) as u32,(self.needs.beer*60/Q) as u32,if self.is_covered_by(tile,11){(60*self.power_fulfillment()/Q) as u32}else{0}]}
    fn capacity(&self,tile:u32)->u32 {2+u32::from(self.is_covered(tile))*5+(3*self.tier.food/Q) as u32+(5*self.needs.clothes/Q) as u32}
    fn update_needs(&mut self) {self.tier.advance_with(1,self.needs.clothes);}
    pub fn advance(&mut self,ticks:u32) {
        self.refresh();
        for _ in 0..ticks.min(3600){
            self.tick=self.tick.saturating_add(1);
            for r in 0..8{
                self.inventory[r]=project_stock(self.inventory[r],self.rate[r],&mut self.carry[r],STORAGE,1);
                self.made[r]+=self.engine.rate(RECIPES[r]);let units=self.made[r]/(60*Q);self.made[r]%=60*Q;self.produced[r]=self.produced[r].saturating_add(units as u32);
            }
            self.display_inventory();self.update_needs();self.refresh();
        }
    }

}
thread_local!{static GAME:RefCell<Industry>=RefCell::new(Industry::starter());}
#[no_mangle] pub extern "C" fn industry_reset(){GAME.with(|g|*g.borrow_mut()=Industry::starter());}
#[no_mangle] pub extern "C" fn industry_validate(tile:u32,kind:u32)->u32 {super::PLANET.with(|p|{let p=p.borrow();GAME.with(|g|{let g=g.borrow();let error=g.validate(tile,kind,&p.surfaces,&p.features,&p.neighbors);if error!=0{error}else if !g.restoring && g.peak_population<Industry::unlock_population(kind){9}else{0}})})}
#[no_mangle] pub extern "C" fn industry_valid_sides(tile:u32,kind:u32)->u32 {super::PLANET.with(|p|{let p=p.borrow();GAME.with(|g|g.borrow().placement_sides(tile,kind,&p.surfaces,&p.neighbors))})}
#[no_mangle] pub extern "C" fn industry_build(tile:u32,kind:u32)->u32 {let mask=industry_valid_sides(tile,kind);industry_build_facing(tile,kind,mask.trailing_zeros())}
#[no_mangle] pub extern "C" fn industry_build_facing(tile:u32,kind:u32,side:u32)->u32 {let error=industry_validate(tile,kind);if error!=0{return error;}super::PLANET.with(|p|{let p=p.borrow();GAME.with(|g|g.borrow_mut().build(tile,kind,side,&p.surfaces,&p.features,&p.neighbors))})}
#[no_mangle] pub extern "C" fn industry_rotate(tile:u32,side:u32)->u32 {super::PLANET.with(|p|{let p=p.borrow();GAME.with(|g|{let mut g=g.borrow_mut();let Some(i)=g.buildings.iter().position(|b|b[0]==tile)else{return 1;};if buildings::farm_kind(g.buildings[i][1] as u8).is_some()||side>=6||Industry::valid_sides(tile,g.buildings[i][1],&p.surfaces,&p.neighbors)&(1<<side)==0{return 7;}g.buildings[i][6]=side;0})})}
#[no_mangle] pub extern "C" fn industry_advance(ticks:u32){GAME.with(|g|g.borrow_mut().advance(ticks));}
#[no_mangle] pub extern "C" fn industry_pool_ptr()->*const u32 {GAME.with(|g|g.borrow().pool.as_ptr())}
#[no_mangle] pub extern "C" fn industry_buildings_ptr()->*const u32 {GAME.with(|g|{let mut g=g.borrow_mut();for i in 0..g.buildings.len(){if g.buildings[i][1]==HOUSE{let tile=g.buildings[i][0];g.buildings[i][7]=g.residents(tile);g.buildings[i][8]=0;g.buildings[i][9]=0;g.buildings[i][10]=u32::from(g.tier.food==Q);}}g.buildings.as_ptr() as *const u32})}
#[no_mangle] pub extern "C" fn industry_count()->u32 {GAME.with(|g|g.borrow().buildings.len() as u32)}
#[no_mangle] pub extern "C" fn industry_workers()->u32 {GAME.with(|g|g.borrow().workers())}
#[no_mangle] pub extern "C" fn industry_population()->u32 {GAME.with(|g|g.borrow().population())}
#[no_mangle] pub extern "C" fn industry_happiness(tile:u32)->u32 {GAME.with(|g|{let g=g.borrow();let f=g.fulfillment(tile);(50+(10*f[0]+20*f[1]+15*f[3]+10*f[4])/60).min(100)})}
#[no_mangle] pub extern "C" fn industry_need(tile:u32,need:u32)->u32 {GAME.with(|g|g.borrow().fulfillment(tile).get(need as usize).copied().unwrap_or(0))}
#[no_mangle] pub extern "C" fn industry_capacity(tile:u32)->u32 {GAME.with(|g|g.borrow().capacity(tile))}
#[no_mangle] pub extern "C" fn industry_restore_needs(_tile:u32,_commons:u32,fish:u32){GAME.with(|g|g.borrow_mut().tier.food=fish.min(60) as u64*Q/60);}

#[no_mangle] pub extern "C" fn industry_stock_ptr()->*const u64{GAME.with(|g|g.borrow().inventory.as_ptr())}
#[no_mangle] pub extern "C" fn industry_rate(resource:u32)->f64{GAME.with(|g|g.borrow().rate.get(resource as usize).copied().unwrap_or(0) as f64/Q as f64/60.0)}
#[no_mangle] pub extern "C" fn industry_storage_cap()->u32{(STORAGE/Q) as u32}
#[no_mangle] pub extern "C" fn industry_production(resource:u32)->f64{GAME.with(|g|RECIPES.get(resource as usize).map(|&r|g.borrow().engine.rate(r) as f64/Q as f64).unwrap_or(0.0))}
#[no_mangle] pub extern "C" fn industry_productivity(kind:u32)->u32{GAME.with(|g|g.borrow().productivity(kind))}
#[no_mangle] pub extern "C" fn industry_carry(resource:u32)->i32{GAME.with(|g|g.borrow().carry.get(resource as usize).copied().unwrap_or(0) as i32)}
#[no_mangle] pub extern "C" fn industry_made(resource:u32)->u32{GAME.with(|g|g.borrow().made.get(resource as usize).copied().unwrap_or(0) as u32)}
#[no_mangle] pub extern "C" fn industry_restore_flow(resource:u32,carry:i32,made:u32){GAME.with(|g|{let mut g=g.borrow_mut();if resource<8&&carry.abs()<60&&(made as u64)<60*Q{g.carry[resource as usize]=carry as i64;g.made[resource as usize]=made as u64;}});}
#[no_mangle] pub extern "C" fn industry_solves()->u32{GAME.with(|g|g.borrow().solves)}
#[no_mangle] pub extern "C" fn industry_restore_stock(resource:u32,low:u32,high:u32){GAME.with(|g|{let mut g=g.borrow_mut();if resource<8{g.inventory[resource as usize]=(((high as u64)<<32)|low as u64).min(production_runtime::MAX);g.display_inventory();g.key.clear();}});}
#[no_mangle] pub extern "C" fn industry_tick()->u32 {GAME.with(|g|g.borrow().tick)}
#[no_mangle] pub extern "C" fn industry_pause(tile:u32)->u32 {GAME.with(|g|{
    let mut g=g.borrow_mut();let Some(i)=g.buildings.iter().position(|b|b[0]==tile) else{return 1;};
    if g.buildings[i][1]==HOUSE||buildings::farm_kind(g.buildings[i][1] as u8).is_some(){return 8;}
    g.buildings[i][2]^=1;if buildings::utility(g.buildings[i][1] as u8)||g.buildings[i][1]==10{g.metadata_dirty=true;}g.refresh();0
})}
#[no_mangle] pub extern "C" fn industry_remove(tile:u32){GAME.with(|g|{let mut g=g.borrow_mut();let removed:Vec<_>=g.buildings.iter().filter(|b|b[0]==tile||g.parent(b)==Some(tile)).map(|b|b[0]).collect();g.buildings.retain(|b|!removed.contains(&b[0]));g.metadata_dirty=true;let refund=removed.into_iter().map(|id|g.paid_costs.remove(&id).unwrap_or(0)).sum::<u32>();g.pool[1]=g.pool[1].saturating_add(refund);g.refresh();});}
#[no_mangle] pub extern "C" fn industry_restore_pool(granules:u32,concrete:u32,tick:u32){GAME.with(|g|{let mut g=g.borrow_mut();g.pool[0]=granules.min(1_000_000_000);g.pool[1]=concrete.min(1_000_000_000);g.tick=tick;});}
#[no_mangle] pub extern "C" fn industry_restore_fish(fish:u32){GAME.with(|g|g.borrow_mut().pool[2]=fish.min(1_000_000_000));}
#[no_mangle] pub extern "C" fn industry_assigned_workers(tile:u32)->u32 {GAME.with(|g|{let g=g.borrow();g.buildings.iter().position(|b|b[0]==tile).map(|i|g.allocation()[i]).unwrap_or(0)})}
#[no_mangle] pub extern "C" fn industry_restore_progress(tile:u32,progress:u32){GAME.with(|g|{if let Some(b)=g.borrow_mut().buildings.iter_mut().find(|b|b[0]==tile){b[4]=progress.min(CYCLE_WORK-1);}});}
#[no_mangle] pub extern "C" fn industry_restore_input(tile:u32,reserved:u32){GAME.with(|g|{if let Some(b)=g.borrow_mut().buildings.iter_mut().find(|b|b[0]==tile){b[5]=if b[1]==1{reserved.min(1)}else{0};}});}
#[no_mangle] pub extern "C" fn industry_restore_house(tile:u32,residents:u32,_credit:u32,_growth:u32,_fed:u32){GAME.with(|g|{let mut g=g.borrow_mut();if let Some(i)=g.buildings.iter().position(|b|b[0]==tile&&b[1]==HOUSE){let old=g.buildings[i][7] as u64;let value=residents.clamp(2,15) as u64;g.tier.population=g.tier.population.saturating_sub(old)+value;g.buildings[i][7]=value as u32;}});}
#[no_mangle] pub extern "C" fn industry_refresh(){GAME.with(|g|g.borrow_mut().refresh());}

#[no_mangle] pub extern "C" fn industry_tutorial()->u32 {GAME.with(|g|g.borrow().tutorial)}
#[no_mangle] pub extern "C" fn industry_restore_tutorial(stage:u32){GAME.with(|g|{let mut g=g.borrow_mut();g.tutorial=stage.min(production_runtime::colony_progression::COMPLETE as u32);});}
#[no_mangle] pub extern "C" fn industry_covered(tile:u32)->u32 {GAME.with(|g|u32::from(g.borrow().is_covered(tile)))}

#[no_mangle] pub extern "C" fn industry_build_cost(kind:u32)->u32 {Industry::cost(kind)}
#[no_mangle] pub extern "C" fn industry_refund(tile:u32)->u32 {GAME.with(|g|g.borrow().paid_costs.get(&tile).copied().unwrap_or(0))}
#[no_mangle] pub extern "C" fn industry_restore_cost(tile:u32,cost:u32){GAME.with(|g|{let mut g=g.borrow_mut();if g.buildings.iter().any(|b|b[0]==tile){g.paid_costs.insert(tile,cost.min(8));}});}

#[no_mangle] pub extern "C" fn industry_peak_population()->u32 {GAME.with(|g|g.borrow().peak_population)}
#[no_mangle] pub extern "C" fn industry_unlock_population(kind:u32)->u32 {Industry::unlock_population(kind)}
#[no_mangle] pub extern "C" fn industry_unlocked(kind:u32)->u32 {GAME.with(|g|u32::from(g.borrow().peak_population>=Industry::unlock_population(kind)))}
#[no_mangle] pub extern "C" fn industry_produced(resource:u32)->u32 {GAME.with(|g|g.borrow().produced.get(resource as usize).copied().unwrap_or(0))}
#[no_mangle] pub extern "C" fn industry_begin_restore(){GAME.with(|g|g.borrow_mut().restoring=true);}
#[no_mangle] pub extern "C" fn industry_restore_progression(peak:u32,stage:u32,granules:u32,concrete:u32,fish:u32){GAME.with(|g|{let mut g=g.borrow_mut();g.peak_population=peak;g.tutorial=stage.min(production_runtime::colony_progression::COMPLETE as u32);g.produced[..3].copy_from_slice(&[granules,concrete,fish]);g.restoring=false;});}

#[no_mangle] pub extern "C" fn industry_worker_cost(kind:u32)->u32{Industry::worker_cost(kind)}

#[no_mangle] pub extern "C" fn industry_tier_ptr()->*const u64 {GAME.with(|g|&g.borrow().tier as *const PopulationTier as *const u64)}
#[no_mangle] pub extern "C" fn industry_metadata_updates()->u32 {GAME.with(|g|g.borrow().metadata_updates)}
#[no_mangle] pub extern "C" fn industry_restore_tier(population:u32,food:u32,growth:u32)->u32 {GAME.with(|g|{let mut g=g.borrow_mut();g.update_metadata();let tier=PopulationTier{population:population as u64,food:food as u64,growth:growth as u64,..g.tier};if !tier.valid(){return 1;}g.tier=tier;g.key.clear();0})}

#[no_mangle] pub extern "C" fn industry_tier_capacity()->u32 {GAME.with(|g|g.borrow().tier.capacity_with(g.borrow().needs.clothes) as u32)}

#[cfg(test)] mod tests {
    use super::*;
    fn colony()->Industry{let mut g=Industry{pool:[0,100,10,0,0,0,0,0],tutorial:5,..Industry::default()};g.neighbors=(0..7).flat_map(|tile|(0..7).filter(move |n|*n!=tile)).collect();g}
    fn add(g:&mut Industry,tile:u32,kind:u32){let surfaces=[1;7];let features=[2;7];let neighbors=g.neighbors.clone();assert_eq!(g.build(tile,kind,0,&surfaces,&features,&neighbors),0);}
    #[test] fn radio_benefit_requires_power_and_releases_demand_when_paused(){
        let mut g=colony();add(&mut g,0,HOUSE);add(&mut g,1,11);
        assert_eq!(g.fulfillment(0)[4],0);assert_eq!(g.buildings[1][3],5);
        add(&mut g,2,10);g.pool[7]=10;g.refresh();assert_eq!(g.fulfillment(0)[4],60);
        g.inventory[7]=0;g.display_inventory();g.key.clear();g.refresh();assert_eq!(g.fulfillment(0)[4],0);
        g.pool[7]=10;g.buildings[1][2]=1;g.metadata_dirty=true;g.refresh();assert_eq!(g.needs.power_demand,0);assert_eq!(g.rate[7],0);assert_eq!(g.fulfillment(0)[4],0);
    }
    #[test] fn coverage_is_metadata_and_overlaps_count_once(){let mut g=colony();add(&mut g,0,HOUSE);add(&mut g,1,HOUSE);add(&mut g,2,COMMONS);add(&mut g,3,COMMONS);assert_eq!(g.tier.commons_covered,2);let updates=g.metadata_updates;g.advance(120);assert_eq!(g.metadata_updates,updates);assert_eq!(g.population(),20);g.buildings.retain(|b|b[0]!=2);g.metadata_dirty=true;g.refresh();assert_eq!(g.tier.commons_covered,2);g.buildings.iter_mut().find(|b|b[0]==3).unwrap()[2]=1;g.metadata_dirty=true;g.refresh();assert_eq!(g.tier.commons_covered,0);g.advance(20);assert_eq!(g.population(),10);}
    #[test] fn tier_consumption_scales_with_population(){let mut g=colony();add(&mut g,0,HOUSE);add(&mut g,1,HOUSE);g.advance(60);assert_eq!(g.population(),10);let before=g.inventory[2];g.advance(60);assert!((before-g.inventory[2]).abs_diff(Q/5)<3);g.inventory[2]=0;g.display_inventory();g.key.clear();g.refresh();assert_eq!(g.tier.food,0);g.advance(6);assert_eq!(g.population(),4);}
    #[test] fn paused_producers_release_workers_starved_producers_do_not(){let mut g=colony();add(&mut g,0,HOUSE);add(&mut g,1,HOUSE);add(&mut g,2,1);g.refresh();assert_eq!(g.workers(),3);assert_eq!(g.productivity(1),0);add(&mut g,3,0);assert_eq!(g.workers(),5);assert_eq!(g.productivity(1),39);g.buildings.iter_mut().find(|b|b[0]==2).unwrap()[2]=1;g.refresh();assert_eq!(g.workers(),2);}
    #[test] fn batched_time_matches_one_second_steps(){let mut a=colony();add(&mut a,0,HOUSE);add(&mut a,1,HOUSE);add(&mut a,2,1);add(&mut a,3,0);let mut b=a.clone();a.advance(600);for _ in 0..600{b.advance(1);}assert_eq!(a.inventory,b.inventory);assert_eq!(a.tier,b.tier);assert_eq!(a.carry,b.carry);}
}

#[no_mangle] pub extern "C" fn industry_resource_count()->u32{8}
#[no_mangle] pub extern "C" fn industry_power()->u32{GAME.with(|g|{let g=g.borrow();g.power() as u32})}
#[no_mangle] pub extern "C" fn industry_restore_extra_needs(clothes:u32,beer:u32){GAME.with(|g|{let mut g=g.borrow_mut();g.needs.clothes=(clothes as u64).min(Q);g.needs.beer=(beer as u64).min(Q);g.key.clear();});}

#[no_mangle]pub extern "C" fn industry_fields(tile:u32)->u32{GAME.with(|g|g.borrow().fields(tile) as u32)}
#[no_mangle]pub extern "C" fn industry_field_parent(tile:u32)->u32{GAME.with(|g|{let g=g.borrow();g.buildings.iter().find(|b|b[0]==tile).and_then(|b|g.parent(b)).unwrap_or(u32::MAX)})}
#[no_mangle]pub extern "C" fn industry_factory_power()->u32{GAME.with(|g|(g.borrow().power_factory*100/Q) as u32)}
