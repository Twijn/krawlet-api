import { DataTypes, Model } from 'sequelize';
import { sequelize } from './database';
import { EstorageEntityLink } from './estoragelink.model';

export const VALID_COLORS = [
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
];

export type EstorageEntityType = 'player' | 'shop' | 'service';

export class EstorageEntity extends Model {
  public id!: string;
  public name!: string;
  public entityType!: EstorageEntityType;
  public colorA!: number;
  public colorB!: number;
  public colorC!: number;
  public active!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EstorageEntity.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    entityType: {
      type: DataTypes.ENUM('player', 'shop', 'service'),
      allowNull: false,
      field: 'entity_type',
    },
    colorA: {
      type: DataTypes.SMALLINT.UNSIGNED,
      validate: {
        isIn: [VALID_COLORS],
      },
      allowNull: false,
      field: 'color_a',
    },
    colorB: {
      type: DataTypes.SMALLINT.UNSIGNED,
      validate: {
        isIn: [VALID_COLORS],
      },
      allowNull: false,
      field: 'color_b',
    },
    colorC: {
      type: DataTypes.SMALLINT.UNSIGNED,
      validate: {
        isIn: [VALID_COLORS],
      },
      allowNull: false,
      field: 'color_c',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'estorage_entities',
    modelName: 'EstorageEntity',
  },
);

export async function findEntityById(entityId: string): Promise<EstorageEntity | null> {
  return EstorageEntity.findOne({
    where: {
      id: entityId,
      active: true,
    },
  });
}

export async function findEntityByPlayerUuid(playerUuid: string): Promise<EstorageEntity | null> {
  const link = await EstorageEntityLink.findOne({
    where: {
      linkType: 'player_uuid',
      linkValue: playerUuid,
    },
  });

  if (!link) {
    return null;
  }

  return findEntityById(link.entityId);
}

export async function findEntityByLookup(lookup: string): Promise<EstorageEntity | null> {
  const trimmedLookup = lookup.trim();
  if (!trimmedLookup) {
    return null;
  }

  const byId = await findEntityById(trimmedLookup);
  if (byId) {
    return byId;
  }

  const link = await EstorageEntityLink.findOne({
    where: {
      linkValue: trimmedLookup,
    },
  });

  if (link) {
    const linkedEntity = await findEntityById(link.entityId);
    if (linkedEntity) {
      return linkedEntity;
    }
  }

  return EstorageEntity.findOne({
    where: {
      name: trimmedLookup,
      active: true,
    },
  });
}
