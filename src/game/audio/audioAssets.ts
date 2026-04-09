const assetModules = import.meta.glob('./assets/*.ogg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function getAssetName(path: string): string {
  const fileName = path.split('/').at(-1);

  if (fileName === undefined) {
    throw new Error(`Invalid audio asset path: ${path}`);
  }

  return fileName.replace(/\.ogg$/u, '');
}

function getAssetPrefix(name: string): string {
  return name.replace(/_\d+$/u, '');
}

const groupedAssets = Object.entries(assetModules)
  .map(([path, url]) => ({ name: getAssetName(path), url }))
  .sort((left, right) => left.name.localeCompare(right.name))
  .reduce<Record<string, string[]>>((groups, asset) => {
    const prefix = getAssetPrefix(asset.name);
    groups[prefix] ??= [];
    groups[prefix].push(asset.url);
    return groups;
  }, {});

function requireGroup(prefix: string): readonly string[] {
  const group = groupedAssets[prefix];

  if (group === undefined || group.length === 0) {
    throw new Error(`Missing audio asset group: ${prefix}`);
  }

  return group;
}

export const audioAssets = {
  computerNoise: requireGroup('computerNoise'),
  doorClose: requireGroup('doorClose'),
  doorOpen: requireGroup('doorOpen'),
  engineCircular: requireGroup('engineCircular'),
  explosionCrunch: requireGroup('explosionCrunch'),
  forceField: requireGroup('forceField'),
  impactMetal: requireGroup('impactMetal'),
  laserLarge: requireGroup('laserLarge'),
  laserRetro: requireGroup('laserRetro'),
  laserSmall: requireGroup('laserSmall'),
  lowFrequencyExplosion: requireGroup('lowFrequency_explosion'),
  spaceEngine: requireGroup('spaceEngine'),
  spaceEngineLarge: requireGroup('spaceEngineLarge'),
  spaceEngineLow: requireGroup('spaceEngineLow'),
  spaceEngineSmall: requireGroup('spaceEngineSmall'),
  thrusterFire: requireGroup('thrusterFire'),
} as const;
