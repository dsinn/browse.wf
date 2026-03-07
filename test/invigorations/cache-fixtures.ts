/**
 * Shared mock cache fixtures for invigoration tests
 *
 * These fixtures represent invigoration cache entries with various warframe combinations.
 * The peek flag is no longer semantically meaningful for caching (since we index by week),
 * so fixtures are named by their response content only.
 */

/**
 * Entry 1: Mag, Volt, Excalibur with ability-focused invigorations
 * Request: peek=false
 */
export const ENTRY_MAG_VOLT_EXCALIBUR = {
  request: {
    n: 'TestUser',
    s: [
      '/Lotus/Powersuits/Mag/MagBaseSuit',
      '/Lotus/Powersuits/Volt/VoltBaseSuit',
      '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
    ],
    p: false
  },
  response: {
    suits: [
      '/Lotus/Powersuits/Mag/MagBaseSuit',
      '/Lotus/Powersuits/Volt/VoltBaseSuit',
      '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
    ],
    offensiveUpgrades: [
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength',
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerRange',
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerDuration'
    ],
    defensiveUpgrades: [
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationEnergy'
    ]
  }
};

/**
 * Entry 2: Rhino, Frost, Loki with weapon-focused invigorations
 * Request: peek=true
 */
export const ENTRY_RHINO_FROST_LOKI_PEEK = {
  request: {
    n: 'TestUser',
    s: [
      '/Lotus/Powersuits/Mag/MagBaseSuit',
      '/Lotus/Powersuits/Volt/VoltBaseSuit',
      '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
    ],
    p: true
  },
  response: {
    suits: [
      '/Lotus/Powersuits/Rhino/RhinoBaseSuit',
      '/Lotus/Powersuits/Frost/FrostBaseSuit',
      '/Lotus/Powersuits/Loki/LokiBaseSuit'
    ],
    offensiveUpgrades: [
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationMeleeDamage',
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPrimaryDamage',
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationSecondaryDamage'
    ],
    defensiveUpgrades: [
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationMovementSpeed',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationParkourSpeed',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationReloadSpeed'
    ]
  }
};

/**
 * Entry 3: Rhino, Frost, Loki with mixed invigorations
 * Request: peek=false
 * (Useful for testing history table with visually distinct data)
 */
export const ENTRY_RHINO_FROST_LOKI = {
  request: {
    n: 'TestUser',
    s: ['/Lotus/Powersuits/Rhino/RhinoBaseSuit'],
    p: false
  },
  response: {
    suits: [
      '/Lotus/Powersuits/Rhino/RhinoBaseSuit',
      '/Lotus/Powersuits/Frost/FrostBaseSuit',
      '/Lotus/Powersuits/Loki/LokiBaseSuit'
    ],
    offensiveUpgrades: [
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationPowerEfficiency',
      '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigorationPowerStrength',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationMovementSpeed'
    ],
    defensiveUpgrades: [
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationHealth',
      '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigorationArmor'
    ]
  }
};
