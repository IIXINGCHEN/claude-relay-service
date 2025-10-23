const EncryptionService = require('../../src/services/encryptionService')

describe('EncryptionService', () => {
  let encryptionService

  beforeEach(() => {
    // 使用测试密钥 (仅用于测试环境)
    const testKey = Buffer.from('test-key-for-unit-tests-only123').toString('hex').substring(0, 32)
    process.env.ENCRYPTION_KEY = testKey
    encryptionService = new EncryptionService()
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plainText = 'This is a secret message'
      const encrypted = encryptionService.encrypt(plainText)
      
      expect(encrypted).not.toBe(plainText)
      expect(encrypted).toContain(':') // Should contain IV separator
      
      const decrypted = encryptionService.decrypt(encrypted)
      expect(decrypted).toBe(plainText)
    })

    it('should generate different ciphertext for same input', () => {
      const plainText = 'Test message'
      const encrypted1 = encryptionService.encrypt(plainText)
      const encrypted2 = encryptionService.encrypt(plainText)
      
      expect(encrypted1).not.toBe(encrypted2) // Different IVs
      expect(encryptionService.decrypt(encrypted1)).toBe(plainText)
      expect(encryptionService.decrypt(encrypted2)).toBe(plainText)
    })

    it('should handle empty string', () => {
      const encrypted = encryptionService.encrypt('')
      const decrypted = encryptionService.decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should handle special characters', () => {
      const plainText = '特殊字符 !@#$%^&*() 测试'
      const encrypted = encryptionService.encrypt(plainText)
      const decrypted = encryptionService.decrypt(encrypted)
      expect(decrypted).toBe(plainText)
    })
  })

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt objects', () => {
      const obj = {
        username: 'admin',
        password: 'secret123',
        apiKey: 'key_abc123'
      }
      
      const encrypted = encryptionService.encryptObject(obj)
      expect(encrypted.username).not.toBe(obj.username)
      expect(encrypted.password).not.toBe(obj.password)
      expect(encrypted.apiKey).not.toBe(obj.apiKey)
      
      const decrypted = encryptionService.decryptObject(encrypted)
      expect(decrypted).toEqual(obj)
    })

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          credentials: {
            token: 'token123'
          }
        }
      }
      
      const encrypted = encryptionService.encryptObject(obj)
      const decrypted = encryptionService.decryptObject(encrypted)
      expect(decrypted).toEqual(obj)
    })

    it('should preserve non-string values', () => {
      const obj = {
        count: 42,
        active: true,
        data: null,
        list: [1, 2, 3]
      }
      
      const encrypted = encryptionService.encryptObject(obj)
      expect(encrypted.count).toBe(42)
      expect(encrypted.active).toBe(true)
      expect(encrypted.data).toBe(null)
      expect(encrypted.list).toEqual([1, 2, 3])
    })
  })

  describe('error handling', () => {
    it('should throw error when decrypting invalid data', () => {
      expect(() => encryptionService.decrypt('invalid')).toThrow()
      expect(() => encryptionService.decrypt('invalid:data')).toThrow()
    })

    it('should handle decryption with wrong key gracefully', () => {
      const encrypted = encryptionService.encrypt('test')
      
      // Change the key
      process.env.ENCRYPTION_KEY = 'different1234567890abcdef1234567'
      const newService = new EncryptionService()
      
      expect(() => newService.decrypt(encrypted)).toThrow()
    })
  })
})
