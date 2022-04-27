const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');

const { mongoose } = require('./db/moongose');

const bodyParser = require('body-parser');

//load in mongoose models
const { List } = require('./db/models/list.model');
const { Task } = require('./db/models/task.model');
const { User } = require('./db/models/user.model');

//load middleware
app.use(bodyParser.json());

app.use(function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
   res.header("Access-Control-Allow-Methods", "GET, POST, HEAD,OPTIONS, PUT, PATCH, DELETE");
   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

   res.header(
      'Access-Control-Expose-Headers',
      'x-access-token, x-refresh-token'
   );
   next();
 });

 //check whether the request has a valid jwt token
 let authenticate = (req, res, next) => {
   let token = req.header('x-access-token');

   jwt.verify(token, User.getJWTSecret(), (error, decoded) => {
      if (error) {
         res.status(401).send(error);
         console.log(error);
      } else {
         req.user_id = decoded._id;
         next();
      }
   })
 }

 //verfiy refresh token middleware
 let verifySession = (req, res, next) => {
   let refreshToken = req.header('x-refresh-token');
   let _id = req.header('_id');

   User.findByIdAndToken(_id, refreshToken).then((user) => {
      if (!user) {
         return Promise.reject({
            'error': 'User not found. Make sure that the refresh token and user id are valid'
         });
      }

      req.user_id = user._id;
      req.userObject = user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach((session) => {
         if (session.token === refreshToken) {
            if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
              isSessionValid = true;
            }
         }
      });

      if (isSessionValid) {
         next();
      } else {
         return Promise.reject({
            'error': 'Refresh token has expired or the session is invalid'
         })
      }
   }).catch((e) => {
      res.status(401);
      console.log(e);
   })
}

/* Route handlers */

/* List routes */
app.get('/lists', authenticate, (req, res) => {
   // we want to return an array of all the lists in the database
   List.find({
      _userId: req.user_id
   }).then((lists) => {
      res.send(lists);
   })
});

app.post('/lists', authenticate, (req, res) => {
   // we want to create a new list and return the new list document back to the user which includes the id
   let title = req.body.title;

   let newList = new List({
      title,
      _userId: req.user_id
   });
   newList.save()
      .then((listDoc) => {
         res.send(listDoc);
      })
      .catch((e) => {
         console.log(e);
      })
})

app.patch('/lists/:id', authenticate, (req, res) => {
   //we want to update the value of the list with the new value specified in the json body of the request
   List.findOneAndUpdate({
       _id: req.params.id,
       _userId: req.user_id
      }, {
      $set: req.body
   })
      .then(() => {
      res.send({message: 'Updated Successfully'})
   })
      .catch((e) => {
         console.log(e);
      })

});

app.delete('/lists/:id', authenticate, (req, res) => {
   List.findOneAndRemove({
       _id: req.params.id,
       _userId: req.user_id
      }).then((removedListDoc) => {
         res.send(removedListDoc);

         deleteTaskFromList(removedListDoc._id);
      }).catch((e) => {
         console.log(e);
      })
})

//get all tasks in a a specific list
app.get('/lists/:listId/tasks', authenticate, (req, res) => {
   Task.find({
      _listId: req.params.listId
   }).then((tasks) => {
      res.send(tasks);
   }).catch((e) => {
      console.log(e);
   })
});

app.post('/lists/:listId/tasks', authenticate, (req, res) => {

   List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
   }).then((list) => {
      if (list) {
         return true;
      }

      return false;
   }).then((canCreateTask) => {
      if (canCreateTask) {
         let newTask = new Task({
            title: req.body.title,
            _listId: req.params.listId
         });
         newTask.save().then((newTaskDoc) => {
            res.send(newTaskDoc)
         }).catch((e) => {
            console.log(e)
         });
      } else {
         res.sendStatus(404);
      }
   })
});

app.patch('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {

   List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
   }).then((list) => {
      if (list) {
         Task.findOneAndUpdate({
            _id: req.params.taskId,
            _listId: req.params.listId
         }, {
            $set: req.body
         }).then(() => {
            res.send({message: 'Updated successfully'})
         }).catch(e => {
            console.log(e)
         })
      } else {
         res.sendStatus(404);
      }
   })
})

app.delete('/lists/:listId/tasks/:taskId', authenticate, (req, res) => {

   List.findOne({
      _id: req.params.listId,
      _userId: req.user_id
   }).then((list) => {
      if (list) {
         Task.findOneAndRemove({
            _id: req.params.taskId,
            _listId: req.params.listId
         }).then((removedTaskDoc) => {
            res.send(removedTaskDoc)
         }).catch(e => {
            console.log(e)
         })
      } else {
         res.sendStatus(404);
      }
   })
})

//User routes
app.post('/users', (req, res) => {
   let body = req.body;
   let newUser = new User(body);

   newUser.save().then(() => {
      return newUser.createSession();
   }).then((refreshToken) => {
      return newUser.generateAccessAuthToken().then((accessToken) => {
         return {accessToken, refreshToken};
      });
   }).then((authTokens) => {
      res
         .header('x-refresh-token', authTokens.refreshToken)
         .header('x-access-token', authTokens.accessToken)
         .send(newUser);
   }).catch((e) => {
      res.status(400).send(e);
   })
})

app.post('/users/login', (req, res) => {
   let email = req.body.email;
   let password = req.body.password;

   User.findByCredentials(email, password).then((user) => {
      return user.createSession().then((refreshToken) => {
         return user.generateAccessAuthToken().then((accessToken) => {
            return { accessToken, refreshToken };
         });
      }).then((authTokens) => {
         res
            .header('x-refresh-token', authTokens.refreshToken)
            .header('x-access-token', authTokens.accessToken)
            .send(user);
      })
   }).catch((e) => {
      res.status(400);
      console.log(e);
   });
})

app.get('/users/me/access-token', verifySession, (req, res) => {
   req.userObject.generateAccessAuthToken().then((accessToken) => {
      res.header('x-access-token', accessToken).send({ accessToken });
   }).catch((e) => {
      res.status(400).send(e);
      console.log(e);
   })
})

let deleteTaskFromList = (_listId) => {
   Task.deleteMany((
      _listId
   )).then(() => {
      console.log('Tasks from ' + _listId + ' were deleted')
   })
}

app.listen(3000, () => {
   console.log('server is listening on port 3000')
});