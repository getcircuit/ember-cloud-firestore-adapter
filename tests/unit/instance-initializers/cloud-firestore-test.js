import { A } from '@ember/array';
import { module, test } from 'qunit';
import { next } from '@ember/runloop';
import { setupTest } from 'ember-qunit';
import ArrayProxy from '@ember/array/proxy';
import EmberObject from '@ember/object';

import sinon from 'sinon';

import { initialize } from 'ember-cloud-firestore-adapter/instance-initializers/cloud-firestore';

module('Unit | Instance Initializer | store', function (hooks) {
  setupTest(hooks);

  module('function: listenForDocChanges', function () {
    test('should listen for record changes', function (assert) {
      assert.expect(2);

      // Arrange
      initialize(this.owner);

      const docRef = {
        id: 'ID',

        onSnapshot(onSuccess) {
          onSuccess({
            exists: true,
            id: 'ID',
            ref: 'ref',

            data() {
              return { name: 'Name' };
            },
          });
        },
      };
      const normalizeStub = sinon.stub().returns({
        data: {
          id: 'ID',
          type: 'user',
          attributes: { name: 'Name' },
        },
      });
      const pushStub = sinon.stub();
      const store = this.owner.lookup('service:store');

      store.set('normalize', normalizeStub);
      store.set('push', pushStub);

      // Act
      store.listenForDocChanges({
        modelName: 'user',

        eachRelationship() {},
      }, docRef);

      // Assert
      next(() => {
        assert.ok(normalizeStub.calledWithExactly('user', { id: 'ID', name: 'Name' }));
        assert.ok(pushStub.calledWithExactly({
          data: {
            id: 'ID',
            type: 'user',
            attributes: { name: 'Name' },
          },
        }));
      });
    });

    test('should unload a record when the document no longer exists', function (assert) {
      assert.expect(2);

      // Arrange
      initialize(this.owner);

      const docRef = {
        id: 'ID',

        onSnapshot(onSuccess) {
          onSuccess({ exists: false });
        },
      };
      const record = EmberObject.create({ isSaving: false });
      const peekRecordStub = sinon.stub().returns(record);
      const unloadRecordStub = sinon.stub();
      const store = this.owner.lookup('service:store');

      store.set('peekRecord', peekRecordStub);
      store.set('unloadRecord', unloadRecordStub);

      // Act
      store.listenForDocChanges({
        modelName: 'user',

        eachRelationship() {},
      }, docRef);

      // Assert
      next(() => {
        assert.ok(peekRecordStub.calledWithExactly('user', 'ID'));
        assert.ok(unloadRecordStub.calledWithExactly(record));
      });
    });

    test('should unload a record when unable to listen for changes and model adapter is configured to unload it', function (assert) {
      assert.expect(3);

      // Arrange
      initialize(this.owner);

      const docRef = {
        id: 'ID',
        parent: { id: 'users' },

        onSnapshot(onSuccess, onError) {
          onError();
        },
      };
      const record = EmberObject.create({ isSaving: false });
      const adapterForStub = sinon.stub().returns(EmberObject.create({
        willUnloadRecordOnListenError: true,
      }));
      const peekRecordStub = sinon.stub().returns(record);
      const unloadRecordStub = sinon.stub();
      const store = this.owner.lookup('service:store');

      store.set('adapterFor', adapterForStub);
      store.set('peekRecord', peekRecordStub);
      store.set('unloadRecord', unloadRecordStub);

      // Act
      store.listenForDocChanges({ modelName: 'user' }, docRef);

      // Assert
      assert.ok(adapterForStub.calledWithExactly('user'));
      assert.ok(peekRecordStub.calledWithExactly('user', 'ID'));
      assert.ok(unloadRecordStub.calledWithExactly(record));
    });

    test('should not unload a record when unable to listen for changes and model adapter is configured to not unload it', function (assert) {
      assert.expect(3);

      // Arrange
      initialize(this.owner);

      const docRef = {
        id: 'ID',
        parent: { id: 'users' },

        onSnapshot(onSuccess, onError) {
          onError();
        },
      };
      const record = EmberObject.create({ isSaving: false });
      const adapterForStub = sinon.stub().returns(EmberObject.create({
        willUnloadRecordOnListenError: false,
      }));
      const peekRecordStub = sinon.stub().returns(record);
      const unloadRecordStub = sinon.stub();
      const store = this.owner.lookup('service:store');

      store.set('adapterFor', adapterForStub);
      store.set('peekRecord', peekRecordStub);
      store.set('unloadRecord', unloadRecordStub);

      // Act
      store.listenForDocChanges({ modelName: 'user' }, docRef);

      // Assert
      assert.ok(adapterForStub.calledWithExactly('user'));
      assert.ok(peekRecordStub.notCalled);
      assert.ok(unloadRecordStub.notCalled);
    });
  });

  module('function: listenForCollectionChanges', function () {
    test('should listen for collection changes', function (assert) {
      assert.expect(1);

      // Arrange
      initialize(this.owner);

      const collectionRef = {
        id: 'users',

        onSnapshot(onSuccess) {
          onSuccess([
            {
              id: 'ID',

              data() {
                return { name: 'Name' };
              },
            },
          ]);
        },
      };
      const findRecordStub = sinon.stub();
      const store = this.owner.lookup('service:store');

      store.set('findRecord', findRecordStub);

      // Act
      store.listenForCollectionChanges(collectionRef);

      // Assert
      next(() => {
        assert.ok(findRecordStub.calledWithExactly('user', 'ID'));
      });
    });
  });

  module('function: listenForQueryChanges', function () {
    test('should listen for query changes', function (assert) {
      assert.expect(2);

      // Arrange
      initialize(this.owner);

      const findRecordStub = sinon.stub().returns({
        _internalModel: { id: 'ID', name: 'Name' },
      });
      const store = this.owner.lookup('service:store');
      const option = { queryId: 'queryId' };
      const queryRef = {
        onSnapshot(onSuccess) {
          store.get('tracker')._query.queryId.recordArray = ArrayProxy.create({
            content: new A([]),
          });

          onSuccess({
            docs: [
              {
                id: 'user_b',

                get() {
                  return {
                    id: 'user_b',
                    parent: { id: 'users' },
                    firestore: {},
                  };
                },
              },
              {
                id: 'user_c',

                get() {},
              },
            ],
          });
        },
      };

      store.set('findRecord', findRecordStub);

      // Act
      store.listenForQueryChanges('user', option, queryRef);

      // Assert
      assert.ok(findRecordStub.firstCall.calledWith('user', 'user_b'));
      assert.ok(findRecordStub.secondCall.calledWithExactly('user', 'user_c', {
        adapterOptions: option,
      }));
    });
  });

  module('function: listenForHasManyChanges', function () {
    test('should listen for hasMany changes', function (assert) {
      assert.expect(3);

      // Arrange
      initialize(this.owner);

      const pushStub = sinon.stub();
      const hasManyStub = sinon.stub().returns({ push: pushStub });
      const peekRecordStub = sinon.stub().returns({ hasMany: hasManyStub });
      const store = this.owner.lookup('service:store');

      store.set('tracker', {
        user: {
          document: {
            user_a: { relationship: {} },
          },
        },
      });
      store.set('findRecord', sinon.stub());
      store.set('peekRecord', peekRecordStub);

      // Act
      store.listenForHasManyChanges('user', 'user_a', { type: 'user', key: 'friends' }, {
        onSnapshot(onSuccess) {
          onSuccess([{ id: 'foo' }]);
        },
      });

      // Assert
      next(() => {
        assert.ok(peekRecordStub.calledWithExactly('user', 'user_a'));
        assert.ok(hasManyStub.calledWithExactly('friends'));
        assert.ok(pushStub.calledWithExactly([
          {
            data: { type: 'user', id: 'foo' },
          },
        ]));
      });
    });
  });
});
