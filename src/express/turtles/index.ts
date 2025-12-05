import { Router } from 'express';
import express from 'express';
import { Turtle, TurtleStat } from '../../lib/models/index.js';

const router = Router();

router.use(express.json());

// Get all turtles
router.get('/', async (req, res) => {
  try {
    const turtles = await Turtle.findAll({
      include: [{ model: TurtleStat, as: 'stats' }],
    });
    res.json({
      ok: true,
      data: turtles.map((t) => t.toApiResponse()),
    });
  } catch (error) {
    console.error('Error fetching turtles:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch turtles',
    });
  }
});

// Get a specific turtle by ID
router.get('/:id', async (req, res) => {
  try {
    const turtle = await Turtle.findByPk(req.params.id, {
      include: [{ model: TurtleStat, as: 'stats' }],
    });
    if (!turtle) {
      return res.status(404).json({
        ok: false,
        error: 'Turtle not found',
      });
    }
    res.json({
      ok: true,
      data: turtle.toApiResponse(),
    });
  } catch (error) {
    console.error('Error fetching turtle:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch turtle',
    });
  }
});

// Create or update a turtle
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  const { label, stats, relativePosition, absolutePosition, fuel } = req.body;

  try {
    // Find or create the turtle
    const [turtle, created] = await Turtle.findOrCreate({
      where: { id },
      defaults: {
        id,
        label,
        relativeX: relativePosition?.x ?? 0,
        relativeY: relativePosition?.y ?? 0,
        relativeZ: relativePosition?.z ?? 0,
        absoluteX: absolutePosition?.x ?? 0,
        absoluteY: absolutePosition?.y ?? 0,
        absoluteZ: absolutePosition?.z ?? 0,
        fuel,
      },
    });

    // If turtle already exists, update it
    if (!created) {
      await turtle.update({
        label: label ?? turtle.label,
        relativeX: relativePosition?.x ?? turtle.relativeX,
        relativeY: relativePosition?.y ?? turtle.relativeY,
        relativeZ: relativePosition?.z ?? turtle.relativeZ,
        absoluteX: absolutePosition?.x ?? turtle.absoluteX,
        absoluteY: absolutePosition?.y ?? turtle.absoluteY,
        absoluteZ: absolutePosition?.z ?? turtle.absoluteZ,
        fuel: fuel ?? turtle.fuel,
      });
    }

    // Update stats if provided
    if (stats && typeof stats === 'object') {
      for (const [statName, statValue] of Object.entries(stats)) {
        if (typeof statValue === 'number') {
          await TurtleStat.upsert({
            turtleId: id,
            statName,
            statValue,
          });
        }
      }
    }

    // Reload with stats
    const updatedTurtle = await Turtle.findByPk(id, {
      include: [{ model: TurtleStat, as: 'stats' }],
    });

    res.json({
      ok: true,
      data: updatedTurtle!.toApiResponse(),
    });
  } catch (error) {
    console.error('Error creating/updating turtle:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create/update turtle',
    });
  }
});

// Update turtle stats
router.patch('/:id/stats', async (req, res) => {
  const { id } = req.params;

  try {
    const turtle = await Turtle.findByPk(id);
    if (!turtle) {
      return res.status(404).json({
        ok: false,
        error: 'Turtle not found',
      });
    }

    // Update stats
    const stats = req.body;
    if (stats && typeof stats === 'object') {
      for (const [statName, statValue] of Object.entries(stats)) {
        if (typeof statValue === 'number') {
          await TurtleStat.upsert({
            turtleId: id,
            statName,
            statValue,
          });
        }
      }
    }

    // Reload with stats
    const updatedTurtle = await Turtle.findByPk(id, {
      include: [{ model: TurtleStat, as: 'stats' }],
    });

    res.json({
      ok: true,
      data: updatedTurtle!.toApiResponse(),
    });
  } catch (error) {
    console.error('Error updating turtle stats:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update turtle stats',
    });
  }
});

// Update turtle position
router.patch('/:id/position', async (req, res) => {
  const { id } = req.params;

  try {
    const turtle = await Turtle.findByPk(id);
    if (!turtle) {
      return res.status(404).json({
        ok: false,
        error: 'Turtle not found',
      });
    }

    const { relativePosition, absolutePosition } = req.body;

    await turtle.update({
      relativeX: relativePosition?.x ?? turtle.relativeX,
      relativeY: relativePosition?.y ?? turtle.relativeY,
      relativeZ: relativePosition?.z ?? turtle.relativeZ,
      absoluteX: absolutePosition?.x ?? turtle.absoluteX,
      absoluteY: absolutePosition?.y ?? turtle.absoluteY,
      absoluteZ: absolutePosition?.z ?? turtle.absoluteZ,
    });

    // Reload with stats
    const updatedTurtle = await Turtle.findByPk(id, {
      include: [{ model: TurtleStat, as: 'stats' }],
    });

    res.json({
      ok: true,
      data: updatedTurtle!.toApiResponse(),
    });
  } catch (error) {
    console.error('Error updating turtle position:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update turtle position',
    });
  }
});

// Delete a turtle
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete stats first (foreign key constraint)
    await TurtleStat.destroy({ where: { turtleId: id } });

    const deleted = await Turtle.destroy({ where: { id } });
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: 'Turtle not found',
      });
    }

    res.json({
      ok: true,
      message: 'Turtle deleted',
    });
  } catch (error) {
    console.error('Error deleting turtle:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete turtle',
    });
  }
});

export default router;
