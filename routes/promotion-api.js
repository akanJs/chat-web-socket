// jshint esversion: 9
const router = require('express').Router();
const uuid = require('uuid');
const { Audience } = require('../models/audience.model');
const { Budget } = require('../models/budget.model');
const { Goal } = require('../models/goal.model');
const { Post } = require('../models/post.model');
const { Promotion } = require('../models/promotion.model');
const { User } = require('../models/users.model');
const logger = require('../functions/logger');

// function to validate budget duration type
/**
 * 
 * @param {string} duration_type
 */
const durationTypeValidator = (duration_type) => {
  const allowedDurationTypes = ['daily', 'weekly'];
  let isAllowed = false;
  for (let allowedType of allowedDurationTypes) {
    if (duration_type.toLowerCase().trim() === allowedType) {
      isAllowed = true;
      break;
    }
  }
  return isAllowed;
};

/**
 * 
 * @param {string} goal_type 
 */
const goalValidator = (goal_type) => {
  const allowedGoalTypes = ['more profile visits', 'more website visit'];
  let isAllowed = false;
  for(let goal of allowedGoalTypes) {
    if(goal_type.trim().toLowerCase() === goal) {
      isAllowed = true;
      break;
    }
  }
  console.log(isAllowed);
  return isAllowed;
};

/**
 * 
 * @param {number} year 
 * @returns 
 */
const leapYearTest = (year) => {
  if((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
    return true;
  }
  return false;
};

const getMaxDate = (month) => {
  let result;

  switch(month) {
    case  0 : 
      result = {name: 'January', maxDate: 31};
      break;
    case 1 :
      result =  leapYearTest ? { name: 'February', maxDate: 29 } : { name: 'February', maxDate: 28 };
      break;
    case 2 :
      result = { name: 'March', maxDate: 31 };
      break;
    case 3 :
      result = { name: 'April', maxDate: 30 };
      break;
    case 4 :
      result = { name: 'May', maxDate: 31 };
      break;
    case 5:
      result = { name: 'June', maxDate: 30 };
      break;
    case 6:
      result = { name: 'July', maxDate: 31 };
      break;
    case 7:
      result = { name: 'August', maxDate: 31 };
      break;
    case 8:
      result = { name: 'September', maxDate: 30 };
      break;
    case 9:
      result = { name: 'October', maxDate: 31 };
      break;
    case 10:
      result = { name: 'November', maxDate: 30 };
      break;
    case 11:
      result = { name: 'December', maxDate: 31 };
      break;
    default:
      result = { name: null, maxDate: null };
  }
  return result;
};

/**
 * 
 * @param {number} days 
 */
const calculateEndDate = (days) => {
  const startDate = new Date();
  const { maxDate, name } = getMaxDate(startDate.getMonth());
  const newDate = startDate.getDate() + days;
  if(newDate > maxDate) {
    const endDay = newDate - maxDate;
    const endMonth = getMaxDate(startDate.getMonth() + 1);
    if(name === 'December' && endMonth.name === 'January') {
      const endDate = new Date(`${endMonth} ${endDay}, ${new Date().getFullYear() + 1}`);
      return endDate;
    }
    const endDate = new Date(`${endMonth.name} ${endDay}, ${new Date().getFullYear()}`);
    return endDate;
  }
  const endDate = new Date(`${name} ${newDate}, ${startDate.getFullYear()}`);
  return endDate;
};

const routes = () => {
  // endpoint to get promotions
  router.route('/get')
    .get(async (req, res) => {
      const { user_id } = req.query;
      if(!user_id) return res.status(400).json({status: false,error: 'missing user id'});
      
      try {
        const user = await User.findOne({ user_id });
        if(!user) return res.status(404).json({status: false, error: 'no user found'});
        // find promotions
        const promotions = await Promotion.find({ user: user._id });
        if(!promotions) return res.status(404).json({status: false, error: 'no promotions found'});
        return res.status(200).json({
          status: true,
          data: promotions
        });
      } catch (error) {
        logger.error(error);
        return res.status(500).json({status: false, error: 'an error occured'});
      }
    });

  // endpoint to create promotion
  router.route('/create')
    .post(async (req, res) => {
      const {
        audience_id,
        goal,
        budget,
        post_id,
        user_id
      } = req.body;

      // validate data exists
      if (!audience_id || !goal || !budget || !post_id || !user_id) {
        return res.status(400).json({
          status: false,
          error: 'missing request body'
        });
      }

      // validate data types
      if (typeof audience_id !== 'string' || typeof goal !== 'object' || typeof budget !== 'object' || typeof post_id !== 'string' || typeof user_id !== 'string') {
        return res.status(400).json({
          status: false,
          error: 'invalid data type'
        });
      }

      // validate goal type
      if(!goal.goal_type || typeof goal.goal_type !=='string' || !goal.url || typeof goal.url !== 'string' || !goalValidator(goal.goal_type)) {
        return res.status(400).json({
          status: false,
          error: 'invalid goal'
        });
      }

      // validate budget object
      if (!budget.amount || typeof Number.parseInt(budget.amount) !== 'number' || !budget.duration || typeof Number.parseInt(budget.duration) !== 'number' || !budget.duration_type || !durationTypeValidator(budget.duration_type)) {
        return res.status(400).json({
          status: false,
          error: 'invalid budget'
        });
      }

      try {
        // find audience and post
        const audience = await Audience.findOne({ audience_id });
        const post = await Post.findOne({ post_id });
        const user = await User.findOne({ user_id });
        if (!audience || !post) return res.status(404).json({status: false, error: 'no audience or post found'});
        
        budget.amount = Number.parseInt(budget.amount);
        budget.duration = Number.parseInt(budget.duration);
        budget.total_amount = budget.amount * budget.duration;
        budget.budget_id = uuid.v4();
        const new_budget = await Budget.create({ ...budget });
        if(!new_budget) {
          return res.status(422).json({
            status: false,
            error: 'could not create budget'
          });
        }
        const new_goal = await Goal.create({
          goal_id: uuid.v4(),
          ...goal
        });
        if(!new_goal) {
          return res.status(422).json({
            status: false,
            error: 'could not create goal'
          });
        }
        const promotion = await Promotion.create({
          promotion_id: uuid.v4(),
          goal: new_goal._id,
          audience: audience._id,
          budget: new_budget._id,
          post: post._id,
          user: user._id,
          start_date: new Date(),
          end_date: calculateEndDate(budget.duration),
          timestamp: Date.now()
        });
        if(!promotion) {
          return res.status(422).json({
            status: false,
            error: 'could not create promotion'
          });
        }
        const postUpdate = await Post.findByIdAndUpdate(post._id, { promoted: true });
        return res.status(201).json({
          status: true,
          data: promotion
        });
      } catch (error) {
        logger.error(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }

    });

  // endpoint to get audience
  router.route('/audience/get')
    .get(async (req, res) => {
      const { user_id, audience_id } = req.query;
      if (!user_id) {
        return res.status(400).json({
          status: false,
          error: 'missing user id'
        });
      }

      if (audience_id) {
        try {
          const audience = await Audience.findOne({ audience_id });
          if (!audience) {
            return res.status(404).json({
              status: false,
              error: 'no audience found'
            });
          }
          return res.status(200).json({
            stauts: true,
            data: audience
          });
        } catch (error) {
          logger.error(error);
          return res.status(500).json({
            status: false,
            error: 'an error occured'
          });
        }
      }

      try {
        // find user
        const user = await User.findOne({ user_id });
        if (!user) {
          return res.status(404).json({
            status: false,
            error: 'user not found'
          });
        }
        // get user created audience
        const audiences = await Audience.find({ user: user._id });
        if (!audiences) {
          return res.status(404).json({
            status: false,
            error: 'no audience found for user'
          });
        }
        return res.status(200).json({
          status: true,
          data: audiences
        });
      } catch (error) {
        // console.log(error);
        logger.error(error);
        return res.status(500).json({
          status: false,
          error: 'an error occured'
        });
      }
    });

  // endpoint to create audience
  router.route('/audience/create')
    .post(async (req, res) => {
      const {
        name,
        country,
        interests,
        gender,
        user_id
      } = req.body;

      // validate data exists
      if (!name || !country || !interests || !gender || !user_id) {
        return res.status(400).json({
          status: false,
          error: 'missing audience property'
        });
      }

      // validate data type
      if (typeof name !== 'string' || typeof country !== 'string' || typeof interests !== 'object' || typeof gender !== 'string' || typeof user_id !== 'string') {
        return res.status(400).json({
          status: false,
          error: 'invalid data type'
        });
      }

      try {
        // find user
        const user = await User.findOne({ user_id });
        if (!user) {
          return res.status(404).json({
            status: false,
            error: 'could not find post'
          });
        }
        // find audience 
        const audienceExists = await Audience.findOne({ name, user: user._id });
        if (audienceExists) {
          return res.status(400).json({
            status: false,
            error: 'audience exists'
          });
        }
        const audience = await Audience.create({
          ...req.body,
          audience_id: uuid.v4(),
          user: user._id
        });

        if (!audience) {
          return res.status(422).json({
            status: false,
            error: 'could not create audience'
          });
        }
        return res.status(201).json({
          status: true,
          data: audience
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

