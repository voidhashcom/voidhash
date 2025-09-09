import { vi } from 'vitest';
import { ApiKeyRepository } from '../../../repositories/api-key-repository';

const defaultMock = {
  createApiKey: vi.fn(),
  getApiKeyById: vi.fn(),
  getApiKeys: vi.fn(),
  updateApiKey: vi.fn(),
  deleteApiKey: vi.fn()
};

export const createMockApiKeyRepository = (
  mockDefinition: typeof defaultMock = defaultMock
) => {
  const mockApiKeyRepository = new ApiKeyRepository(mockDefinition);
  return {
    mock: mockApiKeyRepository,
    helpers: {
      // // Helper methods for test setup
      setupCreateApiKey: (
        result: ReturnType<typeof mockApiKeyRepository.createApiKey>
      ) => {
        mockDefinition.createApiKey.mockReturnValue(result);
      },
      setupGetApiKeyById: (
        result: ReturnType<typeof mockApiKeyRepository.getApiKeyById>
      ) => {
        mockDefinition.getApiKeyById.mockReturnValue(result);
      },
      setupGetApiKeys: (
        result: ReturnType<typeof mockApiKeyRepository.getApiKeys>
      ) => {
        mockDefinition.getApiKeys.mockReturnValue(result);
      },
      setupUpdateApiKey: (
        result: ReturnType<typeof mockApiKeyRepository.updateApiKey>
      ) => {
        mockDefinition.updateApiKey.mockReturnValue(result);
      },
      setupDeleteApiKey: (
        result: ReturnType<typeof mockApiKeyRepository.deleteApiKey>
      ) => {
        mockDefinition.deleteApiKey.mockReturnValue(result);
      },
      // Helper to reset all mocks
      reset: () => {
        mockDefinition.createApiKey.mockReset();
        mockDefinition.getApiKeyById.mockReset();
        mockDefinition.getApiKeys.mockReset();
        mockDefinition.updateApiKey.mockReset();
        mockDefinition.deleteApiKey.mockReset();
      }
    }
  };
};

export type MockApiKeyRepository = ReturnType<
  typeof createMockApiKeyRepository
>;
