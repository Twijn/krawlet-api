import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from './database';
import { TurtleStat } from './turtlestat.model';

export interface RawTurtle {
  id: string;
  label?: string | null;
  relativeX: number;
  relativeY: number;
  relativeZ: number;
  absoluteX: number;
  absoluteY: number;
  absoluteZ: number;
  fuel?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TurtleWithStats extends RawTurtle {
  stats: Record<string, number>;
  relativePosition: { x: number; y: number; z: number };
  absolutePosition: { x: number; y: number; z: number };
}

export class Turtle
  extends Model<InferAttributes<Turtle>, InferCreationAttributes<Turtle>>
  implements RawTurtle
{
  declare id: string;
  declare label: CreationOptional<string | null>;

  declare relativeX: CreationOptional<number>;
  declare relativeY: CreationOptional<number>;
  declare relativeZ: CreationOptional<number>;

  declare absoluteX: CreationOptional<number>;
  declare absoluteY: CreationOptional<number>;
  declare absoluteZ: CreationOptional<number>;

  declare fuel: CreationOptional<number | null>;

  declare createdAt?: Date;
  declare updatedAt?: Date;

  // Association
  declare stats?: NonAttribute<TurtleStat[]>;

  raw(): RawTurtle {
    return {
      id: this.id,
      label: this.label,
      relativeX: this.relativeX,
      relativeY: this.relativeY,
      relativeZ: this.relativeZ,
      absoluteX: this.absoluteX,
      absoluteY: this.absoluteY,
      absoluteZ: this.absoluteZ,
      fuel: this.fuel,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Returns the turtle data in the format expected by the Lua client
   */
  toApiResponse(): TurtleWithStats {
    const statsMap: Record<string, number> = {};
    if (this.stats) {
      for (const stat of this.stats) {
        statsMap[stat.statName] = stat.statValue;
      }
    }

    return {
      ...this.raw(),
      stats: statsMap,
      relativePosition: {
        x: this.relativeX,
        y: this.relativeY,
        z: this.relativeZ,
      },
      absolutePosition: {
        x: this.absoluteX,
        y: this.absoluteY,
        z: this.absoluteZ,
      },
    };
  }
}

Turtle.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    relativeX: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    relativeY: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    relativeZ: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    absoluteX: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    absoluteY: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    absoluteZ: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    fuel: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'turtles',
  },
);
