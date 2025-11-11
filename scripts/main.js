import { world, system } from "@minecraft/server";

const TAGGED_KEY = "BabyTurt:tagged";
const BEFORE_GROW_INTERVAL = 23900;
const PARTICLE_OFF = "minecraft:crop_growth_emitter";
const PARTICLE_ON = "minecraft:heart_particle";
const SOUND_OFF = "block.copper_bulb.turn_off";
const SOUND_ON = "block.copper_bulb.turn_on"
const SOUND_OPTIONS = { pitch: 0.4 };
const EXCLUDED_TYPES = ["minecraft:item", "minecraft:xp_orb"]; 
let INITIALISED = false;

const CACHE = {
	tagged: new Set()
};

function addTagged(entity) {
	CACHE.tagged.add(entity);
	entity.setDynamicProperty(TAGGED_KEY, true);
}

function removeTagged(entity) {
	CACHE.tagged.delete(entity);
	entity.setDynamicProperty(TAGGED_KEY, false);
}


function triggerBorn() {
	const entities = Array.from(CACHE.tagged);
	for (const entity of entities) {
		if (!entity.isValid) {
			CACHE.tagged.delete(entity);
			continue;
		}
		entity.triggerEvent("minecraft:entity_born");
	}
}


function displayInteraction(target, particleID, soundID) {
	const location = target.getHeadLocation();
	location.y += 0.5;
	system.run(()=>{
		target.dimension.playSound(soundID, location, SOUND_OPTIONS);
		target.dimension.spawnParticle(particleID, location);
	});
}

// Initial world load code + notification
world.afterEvents.playerSpawn.subscribe((event) => {
	if (INITIALISED) return;
	INITIALISED = true;
	triggerBorn();
	system.runInterval(triggerBorn, BEFORE_GROW_INTERVAL);
	system.runTimeout(() => world.sendMessage(`§7Baby§2Turt §7Loaded §8[${CACHE.tagged.size} entities tagged]`), 20);
});

// Save entity states
world.beforeEvents.playerInteractWithEntity.subscribe(({ itemStack, target }) => {	
	if (!itemStack || itemStack.typeId !== "minecraft:name_tag" || !itemStack.nameTag) return;

	const ageable = target.getComponent("minecraft:ageable");
	if (!ageable) return;

	if (!target.getDynamicProperty(TAGGED_KEY)) {
		addTagged(target);
		target.triggerEvent("minecraft:entity_born");
		displayInteraction(target, PARTICLE_ON, SOUND_ON);
	};
});

// Add tagged entities to cache on load
world.afterEvents.entityLoad.subscribe(({entity}) => {
	if (EXCLUDED_TYPES.includes(entity.typeId)) return;
	if (entity.getDynamicProperty(TAGGED_KEY)) {
    	CACHE.tagged.add(entity);
	}
});

// Clean up cache on entity removal
world.beforeEvents.entityRemove.subscribe(({removedEntity}) => {
	if (EXCLUDED_TYPES.includes(removedEntity.typeId)) return;
	CACHE.tagged.delete(removedEntity);
});

// Remove tag on name tag use
world.beforeEvents.itemUse.subscribe((event) => {
	if (!event.itemStack || event.itemStack.typeId !== "minecraft:name_tag" || event.itemStack.nameTag !== undefined) return;
	const entities = event.source.getEntitiesFromViewDirection({ maxDistance: 5, includeLiquidBlocks: false, includePassableBlocks: false, excludeTypes: EXCLUDED_TYPES });
	let closest = null;
	for (const entity of entities) {
		if (EXCLUDED_TYPES.includes(entity.entity.typeId) || !entity.entity.getDynamicProperty(TAGGED_KEY)) continue;
        if (!closest || entity.distance < closest.distance) closest = entity;
	}
	if (!closest) return;
	removeTagged(closest.entity);
	displayInteraction(closest.entity, PARTICLE_OFF, SOUND_OFF);


});
