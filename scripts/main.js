import { world, system, GameMode } from "@minecraft/server";

const TAGGED_KEY = "BabyTurt:tagged";
const BEFORE_GROW_INTERVAL = 23900;
const PARTICLE_OFF = "minecraft:crop_growth_emitter";
const PARTICLE_ON = "minecraft:heart_particle";
const SOUND_OFF = "block.copper_bulb.turn_off";
const SOUND_ON = "block.copper_bulb.turn_on";
const SOUND_OPTIONS = { pitch: 0.4 };
const EXCLUDED_TYPES = [
	// Just for performance
	"minecraft:item",
	"minecraft:xp_orb",
	"minecraft:player",
	"minecraft:armor_stand",
	"minecraft:arrow",
	"minecraft:boat",
	"minecraft:chest_minecart",
	"minecraft:command_block_minecart",
	"minecraft:egg",
	"minecraft:ender_pearl",
	"minecraft:eye_of_ender_signal",
	"minecraft:fireball",
	"minecraft:fireworks_rocket",
	"minecraft:fishing_hook",
	"minecraft:hopper_minecart",
	"minecraft:leash_knot",
	"minecraft:minecart",
	"minecraft:painting",
	"minecraft:snowball",
	"minecraft:tnt",
	"minecraft:tnt_minecart",
];
let INITIALISED = false;
let NOTIFIED = false;

const CACHE = {
	tagged: new Set(),
};

function addTagged(entity) {
	CACHE.tagged.add(entity);
	entity.setDynamicProperty(TAGGED_KEY, true);
}

function removeTagged(entity) {
	CACHE.tagged.delete(entity);
	entity.setDynamicProperty(TAGGED_KEY, false);
}

function elevatedTrigger(entity, eventId) {
	system.run(() => {
		entity.triggerEvent(eventId);
	});
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
	system.run(() => {
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
	system.runTimeout(() => {
		if (!NOTIFIED) {
			// Logically this shouldnt be needed but sometimes it duplicates the message.
			world.sendMessage(`§7Baby§2Turt §7Loaded §8[${CACHE.tagged.size} entities tagged]`);
			NOTIFIED = true;
		}
	}, 20);
});

// Save entity states
world.beforeEvents.playerInteractWithEntity.subscribe(({ itemStack, target }) => {
	if (itemStack?.typeId !== "minecraft:name_tag" || EXCLUDED_TYPES.includes(target.typeId)) return; // If not name tag or excluded type, return
	const ageable = target.getComponent("minecraft:ageable");
	if (!ageable) return;
	const isItemNamed = (itemStack && itemStack.nameTag) || false;

	if (!target.getDynamicProperty(TAGGED_KEY) && isItemNamed) {
		addTagged(target);
		displayInteraction(target, PARTICLE_ON, SOUND_ON);
	} else if (target.getDynamicProperty(TAGGED_KEY) && !isItemNamed) {
		removeTagged(target);
		displayInteraction(target, PARTICLE_OFF, SOUND_OFF);
	}
});

// Handle entity interactions
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
	if (EXCLUDED_TYPES.includes(event.target.typeId) || !event.beforeItemStack || !event.itemStack) return;
	const ageable = event.target.getComponent("minecraft:ageable");
	if (!ageable) return;
	if (event.beforeItemStack.amount - event.itemStack.amount === 0 && event.player.getGameMode() !== GameMode.Creative) return;
	if (event.target.getDynamicProperty(TAGGED_KEY)) {
		elevatedTrigger(event.target, "minecraft:entity_born"); // If an item was used on the tagged mob then reset growth to negate feeding
	}
});

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
	if (EXCLUDED_TYPES.includes(entity.typeId)) return;
	if (entity.getDynamicProperty(TAGGED_KEY)) {
		CACHE.tagged.add(entity);
	}
});

// Add tagged entities to cache on load
world.afterEvents.entityLoad.subscribe(({ entity }) => {
	if (EXCLUDED_TYPES.includes(entity.typeId)) return;
	if (entity.getDynamicProperty(TAGGED_KEY)) {
		CACHE.tagged.add(entity);
	}
});

// Clean up cache on entity removal
world.beforeEvents.entityRemove.subscribe(({ removedEntity }) => {
	if (EXCLUDED_TYPES.includes(removedEntity.typeId)) return;
	CACHE.tagged.delete(removedEntity);
});
