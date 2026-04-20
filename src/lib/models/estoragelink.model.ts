import { DataTypes, Model } from 'sequelize';
import { sequelize } from './database';

export type EstorageEntityLinkType = 'player_uuid' | 'shop_computer_id' | 'public_frequency';

export class EstorageEntityLink extends Model {
  public id!: string;
  public entityId!: string;
  public linkType!: EstorageEntityLinkType;
  public linkValue!: string;
  public linkName!: string | null;
  public isPrimary!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EstorageEntityLink.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'entity_id',
    },
    linkType: {
      type: DataTypes.ENUM('player_uuid', 'shop_computer_id', 'public_frequency'),
      allowNull: false,
      field: 'link_type',
    },
    linkValue: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'link_value',
    },
    linkName: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'link_name',
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_primary',
    },
  },
  {
    sequelize,
    tableName: 'estorage_entity_links',
    modelName: 'EstorageEntityLink',
  },
);
