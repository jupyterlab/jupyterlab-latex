module.exports = {
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module'
      },
      plugins: ['@typescript-eslint'],
      rules: {
        // TypeScript rules here
      }
    },
    {
      files: ['**/*.js'],
      parserOptions: {
        // No project option needed for JS files
      },
      rules: {
        // JavaScript rules here
      }
    }
  ]
};
