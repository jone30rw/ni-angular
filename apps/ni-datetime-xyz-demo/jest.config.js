module.exports = {
  name: 'ni-datetime-xyz-demo',
  preset: '../../jest.config.js',
  coverageDirectory: '../../coverage/apps/ni-datetime-xyz-demo',
  snapshotSerializers: [
    'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
    'jest-preset-angular/build/AngularSnapshotSerializer.js',
    'jest-preset-angular/build/HTMLCommentSerializer.js'
  ]
};
