exports.sendResponse = (res, code, message, data, count) => {
  let response = {
    count,
    code,
    message,
    results: data?.length || undefined,
    body: data ? data : []
  };
  return res.status(code).json(response);
};

exports.sendEmailResponse = (res, file) => {
  return res.redirect(file);
};

exports.errReturned = (res, err) => {
  console.log(err);
  res.status(400).json({
    code: 400,
    message: err['message'] || err
  });
};
