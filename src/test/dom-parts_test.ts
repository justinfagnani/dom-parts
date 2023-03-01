import {assert} from '@esm-bundle/chai';
import {ElementPart, getParts, validateParts} from '../index.js';

/**
 * Creates a fresh <template> object (so that tests are isolated) with
 * a couple of parts.
 */
const createTemplateOne = () => {
  const template = document.createElement('template');
  template.innerHTML = `
    <?node-part?><h1>Hello<?child-node-part?>World<?/child-node-part?></h1>
    <?child-node-part?>
      <?node-part?><button>Click me</button>
    <?/child-node-part?>
  `;
  return template;
}

suite('DOM Parts', () => {

  suite('internal getParts() utility function', () => {

    test('gets parts from a <template>', () => {
      const template = createTemplateOne();
      const parts = getParts(template.content);

      // Expect three top-level parts
      assert.equal(parts.length, 3);
      assert.equal(parts[0].kind, 'element');
      assert.equal(parts[1].kind, 'child');
      assert.equal(parts[2].kind, 'child');

      // The third part has a nested child
      assert.equal((parts[2] as ChildPart).childParts.length, 1);

      validateParts(template.content, parts);
    });

    test('parts are cached', () => {
      // getPart() should return the same parts array every call
      const template = createTemplateOne();
      const partsA = getParts(template.content);
      const partsB = getParts(template.content);

      assert.strictEqual(partsA, partsB);
    });

    test('parts are not change by inserting new PIs', () => {
      // Parts only get into the parts list by explicitly adding them
      const template = createTemplateOne();
      const partsA = getParts(template.content);
      assert.equal(partsA.length, 3);

      const newNodeMarker = document.createComment('?node-part?');
      const newNode = document.createElement('div');
      template.content.append(newNodeMarker, newNode);

      const partsB = getParts(template.content);
      assert.strictEqual(partsA, partsB);
      assert.equal(partsB.length, 3);
    })

  });

  suite('getParts() method', () => {

    test('gets parts from a <template>', () => {
      const template = createTemplateOne();
      const parts = template.content.parts;

      assert.equal(parts.length, 3);
    });

    test('parts from a <template> are cached', () => {
      const template = createTemplateOne();
      const partsA = template.content.parts;
      const partsB = template.content.parts;

      assert.strictEqual(partsA, partsB);
    });

  });

  suite('Mutating parts', () => {

    test.skip('Appending new DOM and Parts', () => {
      const template = createTemplateOne();
      const parts = template.content.parts;

      const newNodeMarker = document.createComment('?node-part?');
      const newNode = document.createElement('div');
      template.content.append(newNodeMarker, newNode);

      const newPart = new ElementPart(newNodeMarker);

      // no validity error
      parts.push(newPart);

      parts.pop();

      // out-of-order, should throw
      assert.throws(() => parts.unshift(newPart));
    });

  });

  suite('cloning', () => {

    test('clones parts with <template>', () => {
      const template = createTemplateOne();
      const fragment = template.content.cloneNode(true) as DocumentFragment;

      // Dynamically add part makers, which should *not* show up in the
      // parts list
      const newNodeMarker = document.createComment('?node-part?');
      const newNode = document.createElement('div');
      fragment.append(newNodeMarker, newNode);
      
      const parts = fragment.parts;
      // TODO: fix this by patching .clone() and importNode() or by
      // making a cloneWithParts() method
      assert.equal(parts.length, 3);
    });

  });

  // suite('ChildPart', () => {
  //   test('replace with string', () => {
  //     const template = document.createElement('template');
  //     template.innerHTML = `
  //       <?node-part?><h1>Hello<?child-node-part?>World<?/child-node-part?></h1>
  //     `;

  //   });
  // });
});
