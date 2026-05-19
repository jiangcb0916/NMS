from flask import jsonify


def success(data=None, message="success", code=0, status=200):
    return jsonify({
        "code": code,
        "message": message,
        "data": data,
    }), status


def failure(message, code=1, status=400, data=None):
    return jsonify({
        "code": code,
        "message": message,
        "data": data,
    }), status


def created(data=None, message="创建成功"):
    return success(data=data, message=message, status=201)
