import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from './database.js';

export interface RawTurtleStat {
  turtleId: string;
  statName: string;
  statValue: number;
}

export class TurtleStat
  extends Model<InferAttributes<TurtleStat>, InferCreationAttributes<TurtleStat>>
  implements RawTurtleStat
{
  declare turtleId: string;
  declare statName: string;
  declare statValue: number;

  raw(): RawTurtleStat {
    return {
      turtleId: this.turtleId,
      statName: this.statName,
      statValue: this.statValue,
    };
  }
}

TurtleStat.init(
  {
    turtleId: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
    },
    statName: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      allowNull: false,
    },
    statValue: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    timestamps: false,
    tableName: 'turtle_stats',
  },
);
