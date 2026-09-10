import { EstorageEntityLink, RawTransfer } from '#lib/models';
import { Op } from 'sequelize';

export type RawTransferWithMinecraftShorthand = RawTransfer & {
  fromMcUuid?: string;
  fromMcName?: string;
  toMcUuid?: string;
  toMcName?: string;
};

type PlayerLink = {
  mcUuid: string;
  mcName?: string;
};

function mapPlayerLinks(links: EstorageEntityLink[]): Map<string, PlayerLink> {
  const byEntity = new Map<string, PlayerLink>();

  for (const link of links) {
    if (link.linkType !== 'player_uuid') {
      continue;
    }

    if (!byEntity.has(link.entityId)) {
      byEntity.set(link.entityId, {
        mcUuid: link.linkValue,
        mcName: link.linkName ?? undefined,
      });
    }
  }

  return byEntity;
}

export async function attachMinecraftShorthand(
  transfers: RawTransfer[],
): Promise<RawTransferWithMinecraftShorthand[]> {
  if (transfers.length === 0) {
    return [];
  }

  const entityIds = Array.from(
    new Set(transfers.flatMap((transfer) => [transfer.fromEntityId, transfer.toEntityId])),
  );

  const links = await EstorageEntityLink.findAll({
    where: {
      entityId: {
        [Op.in]: entityIds,
      },
      linkType: 'player_uuid',
    },
    attributes: ['entityId', 'linkType', 'linkValue', 'linkName'],
    order: [
      ['isPrimary', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });

  const playerLinks = mapPlayerLinks(links);

  return transfers.map((transfer) => {
    const fromLink = playerLinks.get(transfer.fromEntityId);
    const toLink = playerLinks.get(transfer.toEntityId);

    return {
      ...transfer,
      fromMcUuid: fromLink?.mcUuid,
      fromMcName: fromLink?.mcName,
      toMcUuid: toLink?.mcUuid,
      toMcName: toLink?.mcName,
    };
  });
}
