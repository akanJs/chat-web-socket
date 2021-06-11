// jshint esversion:9
const router = require('express').Router();
const uuid = require('uuid');
const {
  format
} = require('timeago.js');
const {
  Comment,
  Like
} = require('../models/actions.model');
const {
  Following
} = require('../models/following.model');
const {
  Post
} = require('../models/post.model');
const {
  Seen
} = require('../models/seen.model');
const {
  User
} = require('../models/users.model');
const { Promotion } = require('../models/promotion.model');
const { Audience } = require('../models/audience.model');

/**
 * 
 * @param {number} timestamp 
 * @returns 
 */
const getTimeAgo = (timestamp) => {
  // convert timestamp to date
  const postDate = new Date(timestamp);
  // get the timeago string
  const timeago = format(postDate);
  // allowed timeago
  const allowedTimes = ['just now', 'minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks', 'month', 'months'];
  // Get the time suffix
  const time = timeago.split(' ')[1];
  let allowedTime = null;
  for (let x of allowedTimes) {
    if (x === time) {
      allowedTime = time;
      break;
    }
  }
  if (!allowedTime) {
    return 'post expired';
  }
  if (allowedTime === 'months') {
    // convert month length to number
    const monthNum = Number.parseInt(timeago.split(' ')[0]);
    if (monthNum > 4) {
      return 'post expired';
    }
    return timeago;
  }
  return timeago;
};

/**
 * 
 * @param {Array} array 
 * @returns 
 */
function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]
    ];
  }

  return array;
}

const routes = () => {
  router.route('/get-profile/:id')
    .get(async (req, res) => {
      // get user id from req params
      const {
        id
      } = req.params;
      if (!id) { // no id passed
        return res.status(400).json({
          status: false,
          error: 'missing profile id'
        });
      }
      try {
        // find user
        const user = await User.findOne({
          user_id: id.trim()
        });
        if (user) {
          // find user's post followers and following
          const user_posts = await Post.find({
            posted_by: user._id
          });
          const user_followers = await Following.find({
            followed_user: user._id
          });
          const user_following = await Following.find({
            followed_by: user._id
          });
          // send data
          return res.status(200).json({
            status: true,
            data: {
              profile: {
                posts: user_posts,
                followers: user_followers,
                following: user_following
              }
            }
          });
        }
        return res.status(404).json({
          status: false,
          error: 'no such user'
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/get-posts')
    .get(async (req, res) => {
      const {
        user_id
      } = req.query;
      try {
        // Find user
        const user = await User.findOne({
          user_id
        });
        if (!user_id) {
          return res.status(400).json({
            status: false,
            error: 'missing user id'
          });
        }
        // Create empty array to hold the timeline posts
        const timelinePosts = [];
        // get all promotions
        const expiredPromotions = await Promotion.find({ timestamp: { $gte: Date.now() } }).populate('audience');
        for(let promotion of expiredPromotions) {
          if(!promotion.expired) {
            const expirePromotion = await Promotion.findByIdAndUpdate(promotion._id, { expired: true });
            console.log('marked promotion as expired', expirePromotion);
          }
        }

        const allPromotions = await Promotion.find({ expired: false }).populate('audience');

        for (let interest of user.interests) { // iterate over user's interests
          const interest_posts = await Post.find({ tags: interest }); // find post related to current interest
          const promotions = allPromotions.filter((x) => x.audience.interests.includes(interest));
          if (promotions) {
            for (let promotion of promotions) {
              const promotionPost = await Post.findById(promotion.post);
              const postInTimeLine = timelinePosts.find((x) => x.post_id === promotionPost.post_id);
              if (!postInTimeLine) {
                timelinePosts.push(promotionPost);
              }
            }
          }
          for (let post of interest_posts) {
            const postInTimeline = timelinePosts.find((x) => x.post_id === post.post_id);
            if (!postInTimeline) {
              const timeago = getTimeAgo(post.timestamp);
              // post longer than four months
              if (timeago && timeago === 'post expired') {
                continue;
              }
              if (timeago && timeago != 'post expired') { // post is within four months
                // check if the post has been seen by user
                const postHasBeenSeen = await Seen.findOne({
                  post_id: post._id,
                  seen_by: user._id
                });
                // get the likes and comment and check if the length is greater than or equal 10
                const postLikes = await Like.find({
                  post_id: post._id
                });
                const postComments = await Comment.find({
                  post_id: post._id
                });
                console.log('post performance: ', postLikes.length + postComments.length);
                const postPerformance = postLikes.length + postComments.length;
                if (!postHasBeenSeen && postPerformance >= 50) {
                  // push post to timeline array
                  console.log('post meets timeline criteria');
                  timelinePosts.push(post);
                }
              }
            }
            continue;
          }
        }
        // find all user's followers
        const followings = await Following.find({
          followed_by: user._id
        });

        for (let following of followings) { // iterate through the user's following array
          // find the posts of each follower
          const following_posts = await Post.find({
            posted_by: following.followed_user
          }).populate('posted_by');
          for (let post of following_posts) { // iterate through each followers posts
            // check how long the post has been created
            const timeago = getTimeAgo(post.timestamp);
            // post longer than four months
            if (timeago && timeago === 'post expired') {
              continue;
            }
            if (timeago && timeago != 'post expired') { // post is within four months
              // check if the post has been seen by user
              const postHasBeenSeen = await Seen.findOne({
                post_id: post._id,
                seen_by: user._id
              });
              if (!postHasBeenSeen) {
                const postInTimeLine = timelinePosts.find((x) => x.post_id === post.post_id);
                if (!postInTimeLine) {
                  timelinePosts.push(post);
                }
              }
              // // get the likes and comment and check if the length is greater than or equal 10
              // const postLikes = await Like.find({
              //   post_id: post._id
              // });
              // const postComments = await Comment.find({
              //   post_id: post._id
              // });
              // const postPerformance = postLikes.length + postComments.length;
              // if (!postHasBeenSeen && postPerformance >= 50) {
              //   // push post to timeline array
              //   console.log('post meets timeline criteria');
              //   timelinePosts.push(post);
              // }
            }
          }
        }

        // console.log('timeline posts: ', timelinePosts);
        // randomize timeline array
        const randomTimelinePosts = shuffle(timelinePosts);
        // console.log('randomized posts: ', randomTimelinePosts);
        // send randomaized array to user
        return res.status(200).json({
          status: true,
          data: {
            posts: randomTimelinePosts
          }
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/create-post')
    .post(async (req, res) => {
      const postBody = {
        ...req.body
      };
      if (!postBody) {
        return res.status(400).json({
          status: false,
          error: 'missing post body'
        });
      }
      // create new post
      postBody.post_id = uuid.v4();
      try {
        const user = await User.findOne({
          user_id: postBody.posted_by
        });
        if (user) {
          postBody.posted_by = user._id;
          const post = await (await Post.create(postBody)).execPopulate({
            path: 'posted_by'
          });
          if (post) {
            return res.status(201).json({
              status: true,
              data: {
                message: 'post created successfully',
                post
              }
            });
          }
          return res.status(422).json({
            status: false,
            error: 'post not created'
          });
        }
        return res.status(422).json({
          status: false,
          error: 'user not found'
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/like-post')
    .post(async (req, res) => {
      const likeData = {
        ...req.body
      };
      if (!likeData) {
        return res.status(400).json({
          status: false,
          error: 'missing like data'
        });
      }

      try {
        likeData.like_id = uuid.v4();
        const likeExist = await Like.findOne({
          post_id: likeData.post_id,
          liked_by: likeData.liked_by
        });
        if (likeExist) {
          Like.findByIdAndDelete(likeExist._id, {}, (err, doc, resp) => {
            if (err) {
              console.log(err);
              return res.status(422).json({
                status: false,
                error: err.message
              });
            }
            console.log(doc, resp);
            return res.status(204).json({
              status: true,
              data: {
                message: 'post unliked'
              }
            });
          });
          return;
        }
        const like = await (await Like.create(likeData)).execPopulate({
          path: 'liked_by'
        });
        if (like) {
          return res.status(201).json({
            status: true,
            data: {
              message: 'like successful',
              like
            }
          });
        }
        return res.status(422).json({
          status: false,
          error: 'like not successful'
        });
      } catch (error) {
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/comment-post')
    .post(async (req, res) => {
      const commentData = {
        ...req.body
      };
      if (!commentData) {
        return res.status(400).json({
          status: false,
          error: 'missing comment data'
        });
      }
      try {
        const postExists = await Post.findById(commentData.post_id);
        if (postExists) {
          commentData.comment_id = uuid.v4();
          console.log(commentData);
          const comment = await (await Comment.create(commentData)).execPopulate({
            path: 'commented_by post_id'
          });
          if (comment) {
            console.log('created comment: ', comment);
            return res.status(201).json({
              status: true,
              data: {
                message: 'comment created',
                comment
              }
            });
          }
          return res.status(422).json({
            status: false,
            error: 'comment not created'
          });
        }
        return res.status(404).json({
          status: false,
          error: 'post not found'
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  router.route('/follow')
    .post(async (req, res) => {
      const {
        followed_user,
        followed_by
      } = req.body;
      if (!followed_user || !followed_by) {
        return res.status(400).json({
          status: false,
          error: 'missing follow data'
        });
      }
      try {
        const followed_user_doc = await User.findOne({
          user_id: followed_user
        });
        const followed_by_doc = await User.findOne({
          user_id: followed_by
        });
        if (!followed_user_doc || !followed_by_doc) {
          return res.status(422).json({
            status: false,
            error: 'no such users'
          });
        }
        const following = await Following.findOne({
          followed_user: followed_user_doc._id,
          followed_by: followed_by_doc._id
        });
        if (!following) {
          const new_following = await (await Following.create({
            following_id: uuid.v4(),
            followed_user: followed_user_doc._id,
            followed_by: followed_by_doc._id
          })).execPopulate({
            path: 'followed_user followed_by'
          });
          if (new_following) {
            return res.status(201).json({
              status: true,
              data: {
                message: 'follow successful',
                follow_result: new_following
              }
            });
          }
        }
        Following.findByIdAndDelete(following._id, {}, (err, doc, result) => {
          if (err) {
            return res.status(500).json({
              status: false,
              error: err.message
            });
          }
          console.log('Doc: ', doc);
          console.log('Result: ', result);
          return res.status(204).json({
            status: true,
            data: {
              message: 'unfollow complete'
            }
          });
        });
      } catch (error) {

      }
    });

  router.route('/markasseen')
    .post(async (req, res) => {
      // get user id and post id from req body
      const {
        user_id,
        post_id
      } = req.body;
      if (!user_id || !post_id) {
        return res.status(400).json({
          status: false,
          error: 'missing post parameter'
        });
      }
      try {
        // find user and post
        const user = await User.findOne({
          user_id
        });
        const post = await Post.findOne({
          post_id
        });
        if (!user || !post) {
          // send error
          return res.status(422).json({
            status: false,
            error: 'could not find user or post'
          });
        }

        // find seen record
        const postHasBeenSeen = await Seen.findOne({
          seen_by: user._id,
          post_id: post._id
        });
        if (postHasBeenSeen) {
          return res.status(200).json({
            status: false,
            message: 'post already marked as seen'
          });
        }

        // mark post as seen
        const markPostAsSeen = await Seen.create({
          seen_id: uuid.v4(),
          post_id: post._id,
          seen_by: user._id
        });
        // update seen property in post object
        const postUpdate = await Post.findByIdAndUpdate(post._id, {
          seen: true
        });
        if (markPostAsSeen && postUpdate) { // mark successful
          return res.status(200).json({
            status: !postUpdate.seen,
            data: {
              message: 'marked as seen',
              seen_post: markPostAsSeen
            }
          });
        }
        // mark unsuccessful
        return res.status(422).json({
          status: false,
          error: 'could not create post'
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });
  return router;
};

module.exports = routes;