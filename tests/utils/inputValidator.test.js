const { validateUsername, validateEmail } = require('../../src/utils/inputValidator')

describe('Input Validator', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(() => validateUsername('john_doe')).not.toThrow()
      expect(() => validateUsername('user123')).not.toThrow()
      expect(() => validateUsername('admin-user')).not.toThrow()
    })

    it('should reject invalid usernames', () => {
      expect(() => validateUsername('')).toThrow('用户名必须是非空字符串')
      expect(() => validateUsername('ab')).toThrow('用户名长度必须在3-64个字符之间')
      expect(() => validateUsername('user@123')).toThrow('用户名只能包含字母、数字、下划线和连字符')
      expect(() => validateUsername('-user')).toThrow('用户名不能以连字符开头或结尾')
    })

    it('should handle edge cases', () => {
      expect(() => validateUsername(null)).toThrow('用户名必须是非空字符串')
      expect(() => validateUsername(123)).toThrow('用户名必须是非空字符串')
      expect(() => validateUsername('a'.repeat(65))).toThrow('用户名长度必须在3-64个字符之间')
    })
  })

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(() => validateEmail('user@example.com')).not.toThrow()
      expect(() => validateEmail('test.user@domain.co.uk')).not.toThrow()
      expect(() => validateEmail('admin+tag@company.org')).not.toThrow()
    })

    it('should reject invalid emails', () => {
      expect(() => validateEmail('')).toThrow('电子邮件必须是非空字符串')
      expect(() => validateEmail('invalid')).toThrow('电子邮件格式无效')
      expect(() => validateEmail('@domain.com')).toThrow('电子邮件格式无效')
      expect(() => validateEmail('user@')).toThrow('电子邮件格式无效')
    })

    it('should handle long emails', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      expect(() => validateEmail(longEmail)).toThrow('电子邮件地址过长')
    })
  })
})
