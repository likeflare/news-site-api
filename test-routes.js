const express = require('express');

// Test individual route files
const categoriesRouter = require('./dist/routes/categories').default;
const articlesRouter = require('./dist/routes/articles').default;

console.log('Categories router:', categoriesRouter);
console.log('Categories router stack:', categoriesRouter.stack.length);
console.log('Articles router:', articlesRouter);
console.log('Articles router stack:', articlesRouter.stack.length);

const app = express();
app.use(express.json());

app.use('/api/articles', articlesRouter);
app.use('/api/categories', categoriesRouter);

app.listen(3002, () => {
  console.log('Test server on 3002');
  console.log('Test: curl http://localhost:3002/api/articles');
  console.log('Test: curl http://localhost:3002/api/categories');
});
