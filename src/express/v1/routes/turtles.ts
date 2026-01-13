import { Router } from 'express';
import express from 'express';
import { Turtle, TurtleStat } from '../../../lib/models';

const router = Router();

router.use(express.json());

// GET /v1/turtles - Get all turtles
router.get('/', async (req, res) => {
  try {
    const turtles = await Turtle.findAll({
      include: [{ model: TurtleStat, as: 'stats' }],
    });
    return res.success(turtles.map((t) => t.toApiResponse()));
  } catch (error) {
    console.error('Error fetching turtles:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch turtles', 500);
  }
});

// GET /v1/turtles/:id - Get a specific turtle by ID
router.get('/:id', async (req, res) => {
  try {
    const turtle = await Turtle.findByPk(req.params.id, {
      include: [{ model: TurtleStat, as: 'stats' }],
    });
    if (!turtle) {
      return res.error('TURTLE_NOT_FOUND', `Turtle with ID ${req.params.id} not found`, 404);
    }
    return res.success(turtle.toApiResponse());
  } catch (error) {
    console.error('Error fetching turtle:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch turtle', 500);
  }
});

// POST /v1/turtles/:id - Create or update a turtle
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

    return res.success(updatedTurtle!.toApiResponse(), created ? 201 : 200);
  } catch (error) {
    console.error('Error creating/updating turtle:', error);
    return res.error('INTERNAL_ERROR', 'Failed to create/update turtle', 500);
  }
});

// PATCH /v1/turtles/:id/stats - Update turtle stats
router.patch('/:id/stats', async (req, res) => {
  const { id } = req.params;

  try {
    const turtle = await Turtle.findByPk(id);
    if (!turtle) {
      return res.error('TURTLE_NOT_FOUND', `Turtle with ID ${id} not found`, 404);
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

    return res.success(updatedTurtle!.toApiResponse());
  } catch (error) {
    console.error('Error updating turtle stats:', error);
    return res.error('INTERNAL_ERROR', 'Failed to update turtle stats', 500);
  }
});

// PATCH /v1/turtles/:id/position - Update turtle position
router.patch('/:id/position', async (req, res) => {
  const { id } = req.params;

  try {
    const turtle = await Turtle.findByPk(id);
    if (!turtle) {
      return res.error('TURTLE_NOT_FOUND', `Turtle with ID ${id} not found`, 404);
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

    return res.success(updatedTurtle!.toApiResponse());
  } catch (error) {
    console.error('Error updating turtle position:', error);
    return res.error('INTERNAL_ERROR', 'Failed to update turtle position', 500);
  }
});

// DELETE /v1/turtles/:id - Delete a turtle
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete stats first (foreign key constraint)
    await TurtleStat.destroy({ where: { turtleId: id } });

    const deleted = await Turtle.destroy({ where: { id } });
    if (!deleted) {
      return res.error('TURTLE_NOT_FOUND', `Turtle with ID ${id} not found`, 404);
    }

    return res.success({ message: 'Turtle deleted successfully' });
  } catch (error) {
    console.error('Error deleting turtle:', error);
    return res.error('INTERNAL_ERROR', 'Failed to delete turtle', 500);
  }
});

export default router;
