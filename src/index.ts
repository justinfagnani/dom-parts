import {addObserver, ObservableArray} from './lib/observable-array.js';

declare global {
  type PartKind = 'child' | 'element';

  type Part = ElementPart | ChildPart;

  interface ElementPart {
    readonly kind: 'element';
    readonly marker: Comment;
    readonly element: Element;
  }

  interface ChildPart {
    readonly kind: 'child';
    readonly startNode: Comment;
    readonly endNode: Comment;
    readonly childParts: Array<Part>;
  }

  interface PartRoot extends Node {
    parts: Array<Part>;
  }

  interface DocumentOrShadowRoot extends PartRoot {
  }

  interface DocumentFragment extends PartRoot {
  }
}

export class ElementPart implements ElementPart {
  readonly kind = 'element';
  readonly marker: Comment;
  readonly element: Element;

  constructor(marker: Comment) {
    const element = marker.nextElementSibling;
    if (element === null) {
      throw new Error('marker must be the previous sibling of an element');
    }
    this.marker = marker;
    this.element = element;
  }
}

export class ChildPart implements ChildPart {
  readonly kind = 'child';
  readonly startNode: Comment;
  readonly endNode: Comment;
  readonly childParts: Array<Part>;

  constructor(startNode: Comment, endNode: Comment, childParts: Array<Part>) {
    if (startNode === null || endNode === null) {
      throw new Error('startNode and endNode must not be null');
    }
    if (startNode.parentNode !== endNode.parentNode) {
      throw new Error('startNode and endNode must have the same parent');
    }
    if (
      startNode.compareDocumentPosition(endNode) !==
      Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      throw new Error('endNode must be following startNode');
    }
    this.startNode = startNode;
    this.endNode = endNode;
    this.childParts = childParts;
  }
}

const partsCache = new WeakMap<PartRoot, ObservableArray<Part>>();

export const getParts = (root: PartRoot): ObservableArray<Part> => {
  let parts = partsCache.get(root)!;
  if (parts !== undefined) {
    return parts;
  } else {
    parts = new ObservableArray();
    partsCache.set(root, parts);
    addObserver(parts, () => {
      validateParts(root, parts);
    });
  }

  // Depending on the type of our root, get a document and a root node to walk
  const isDocument = (root as Document).nodeType === Node.DOCUMENT_NODE;
  const d: Document = isDocument
    ? (root as Document)
    : (root as unknown as DocumentFragment).ownerDocument;
  const rootNode: Node = isDocument
    ? (root as Document).getRootNode()
    : (root as unknown as DocumentFragment);

  // A stack of open child parts so we can build a tree of parts
  const openChildPartStack: Array<{
    startNode: Comment;
    outerParts: Array<Part>;
  }> = [];

  // The current parts array we're filling. Either the top-level parts array,
  // or the child parts array of the current open child part.

  const walker = d.createTreeWalker(rootNode, NodeFilter.SHOW_COMMENT);
  let node: Comment | null;

  while ((node = walker.nextNode() as typeof node) !== null) {
    const {data} = node;

    if (data === '?node-part?') {
      parts.push(new ElementPart(node));
    } else if (data === '?child-node-part?') {
      openChildPartStack.push({startNode: node, outerParts: parts});
      parts = [];
    } else if (data === '?/child-node-part?') {
      const childPartData = openChildPartStack.pop();
      if (childPartData === undefined) {
        throw new Error('Unexpected end child part');
      }
      const childPart = new ChildPart(childPartData.startNode, node, parts);
      (parts = childPartData.outerParts).push(childPart);
    }
  }

  if (openChildPartStack.length > 0) {
    throw new Error('Unbalanced start child part');
  }
  return parts;
};

/**
 * Validates a list of parts
 * 
 */
export const validateParts = (root: PartRoot, parts: Array<Part>) => {
  let previousMarker: Node | undefined;
  for (const part of parts) {
    if (part.kind === 'child') {
      if (part.startNode === null || part.endNode === null) {
        throw new Error('startNode and endNode must not be null');
      }
      if (part.startNode.parentNode !== part.endNode.parentNode) {
        throw new Error('startNode and endNode must have the same parent');
      }
      if (!root.contains(part.startNode)) {
        throw new Error('startNode must be contained by the root');
      }
      if (!root.contains(part.endNode)) {
        throw new Error('endNode must be contained by the root');
      }
      if (
        part.startNode.compareDocumentPosition(part.endNode) !==
        Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        throw new Error('endNode must be following startNode');
      }
      if (
        previousMarker && previousMarker.compareDocumentPosition(part.startNode) !==
        Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        throw new Error('overlapping child parts');
      }
      previousMarker = part.endNode;
    } else {
      if (!root.contains(part.element)) {
        throw new Error('element root must be contained by root');
      }
      previousMarker = part.marker;
    }
  }
}

//
// Patch prototypes
//

for (const cls of [DocumentFragment, Document]) {
  Object.defineProperty(cls.prototype, 'parts', {
    get() {
      return getParts(this);
    }
  })
}
