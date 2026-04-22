import { ApiKey, findEntityById, findEntityByPlayerUuid } from '../../lib/models';

export async function resolveClientEntityId(apiKeyId: string): Promise<string | null> {
  const apiKey = await ApiKey.findByPk(apiKeyId);
  if (!apiKey) {
    return null;
  }

  if (apiKey.estorageEntityId) {
    const entity = await findEntityById(apiKey.estorageEntityId);
    if (entity) {
      return entity.id;
    }
  }

  if (apiKey.mcUuid) {
    const entity = await findEntityByPlayerUuid(apiKey.mcUuid);
    if (entity) {
      return entity.id;
    }
  }

  return null;
}
