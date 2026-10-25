import js from '@eslint/js'
import tseslint from 'typescript-eslint'
export default tseslint.config({ignores:['out/**','dist/**','.tooling/**']},js.configs.recommended,...tseslint.configs.recommended,{rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}})
