// Custom ESLint rules for Obsidian plugin development
// These rules help enforce Obsidian's review requirements

module.exports = {
  rules: {
    // Rule to prevent command names with plugin prefix
    'no-plugin-prefix-commands': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent command names from including plugin name prefix',
        },
        fixable: 'code',
        schema: []
      },
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string') {
              // Check for "Nova:" or plugin name in command titles
              if (node.value.includes('Nova:')) {
                context.report({
                  node,
                  message: 'Command names should not include the plugin name prefix "Nova:"',
                  fix(fixer) {
                    const fixed = node.value.replace(/Nova:\s*/g, '');
                    return fixer.replaceText(node, `"${fixed}"`);
                  }
                });
              }
            }
          }
        };
      }
    },

    // Rule to detect CSS-in-JS patterns that should be in CSS files
    'no-css-in-js': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Prevent CSS-in-JS patterns, prefer CSS classes',
        },
        schema: []
      },
      create(context) {
        return {
          Property(node) {
            if (node.key && node.key.name === 'cssText') {
              context.report({
                node,
                message: 'Avoid cssText property. Use CSS classes instead for better theme compatibility.'
              });
            }
          },
          CallExpression(node) {
            // Detect setCssProperty calls that should be CSS classes
            if (node.callee.property && node.callee.property.name === 'setCssProperty') {
              const firstArg = node.arguments[0];
              if (firstArg && firstArg.type === 'Literal') {
                // Common style properties that should be CSS classes
                const commonProps = ['display', 'visibility', 'opacity', 'transform', 'background', 'color', 'border'];
                if (commonProps.includes(firstArg.value)) {
                  context.report({
                    node,
                    message: `Consider using CSS classes instead of setCssProperty for '${firstArg.value}' property.`
                  });
                }
              }
            }
          }
        };
      }
    }
  }
};